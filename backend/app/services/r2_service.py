"""Cloudflare R2 storage service using Boto3 (S3-compatible).

Provides presigned URL generation for browser-direct uploads/downloads,
file deletion, listing, existence checks, and server-side copy.
"""

import logging
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Default presigned URL expiration times (in seconds)
UPLOAD_EXPIRY = 3600       # 1 hour for uploads
DOWNLOAD_EXPIRY = 3600     # 1 hour for downloads


class R2Service:
    """Handles file operations with Cloudflare R2 (S3-compatible).

    Uses boto3 with S3-compatible endpoint for Cloudflare R2.
    All methods are sync (boto3 is sync) but wrapped for async callers
    via run_in_executor in the routes that use them.
    """

    def __init__(self) -> None:
        settings = get_settings()

        # Build the R2 endpoint URL
        # R2_ENDPOINT can be either full URL or just account ID
        if settings.R2_ENDPOINT and settings.R2_ENDPOINT.startswith("http"):
            endpoint_url = settings.R2_ENDPOINT
        elif settings.R2_ACCOUNT_ID:
            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        else:
            endpoint_url = None
            logger.warning(
                "R2 endpoint not configured. R2Service will operate in mock mode."
            )

        self._bucket_name = settings.R2_BUCKET_NAME
        self._endpoint_url = endpoint_url
        self._mock_mode = endpoint_url is None or not settings.R2_ACCESS_KEY_ID

        if not self._mock_mode:
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=BotoConfig(
                    signature_version="s3v4",
                    retries={"max_attempts": 3, "mode": "standard"},
                ),
                region_name="auto",
            )
            logger.info(
                "R2Service initialized: bucket=%s endpoint=%s",
                self._bucket_name,
                endpoint_url,
            )
        else:
            self._client = None
            logger.warning(
                "R2Service running in MOCK mode (no credentials configured). "
                "Upload/download URLs will be placeholders."
            )

    @property
    def is_configured(self) -> bool:
        """Check if R2 is properly configured with real credentials."""
        return not self._mock_mode

    def generate_presigned_upload_url(
        self,
        file_key: str,
        content_type: str = "audio/mpeg",
        expiry: int = UPLOAD_EXPIRY,
    ) -> str:
        """Generate a presigned PUT URL for uploading a file directly from the browser.

        Args:
            file_key: The S3/R2 object key (e.g. "projects/{id}/audio/original.mp3")
            content_type: MIME type of the file being uploaded
            expiry: URL expiration in seconds (default 1 hour)

        Returns:
            Presigned URL string for PUT upload
        """
        if self._mock_mode:
            logger.debug("Mock presigned upload URL for key: %s", file_key)
            return f"https://mock-r2.example.com/{self._bucket_name}/{file_key}?upload=true"

        try:
            url = self._client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self._bucket_name,
                    "Key": file_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expiry,
            )
            logger.debug("Generated presigned upload URL for key: %s", file_key)
            return url
        except ClientError as e:
            logger.error("Failed to generate presigned upload URL: %s", e)
            raise

    def generate_presigned_download_url(
        self,
        file_key: str,
        expiry: int = DOWNLOAD_EXPIRY,
        filename: Optional[str] = None,
    ) -> str:
        """Generate a presigned GET URL for downloading a file.

        Args:
            file_key: The S3/R2 object key
            expiry: URL expiration in seconds (default 1 hour)
            filename: Optional filename for Content-Disposition header

        Returns:
            Presigned URL string for GET download
        """
        if self._mock_mode:
            logger.debug("Mock presigned download URL for key: %s", file_key)
            return f"https://mock-r2.example.com/{self._bucket_name}/{file_key}?download=true"

        try:
            params = {
                "Bucket": self._bucket_name,
                "Key": file_key,
            }
            if filename:
                params["ResponseContentDisposition"] = (
                    f'attachment; filename="{filename}"'
                )

            url = self._client.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=expiry,
            )
            logger.debug("Generated presigned download URL for key: %s", file_key)
            return url
        except ClientError as e:
            logger.error("Failed to generate presigned download URL: %s", e)
            raise

    def upload_file_bytes(
        self,
        file_key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload file bytes directly from the server (for processed files like trimmed audio).

        Args:
            file_key: The S3/R2 object key
            data: File content as bytes
            content_type: MIME type

        Returns:
            The file key that was uploaded
        """
        if self._mock_mode:
            logger.debug("Mock upload for key: %s (%d bytes)", file_key, len(data))
            return file_key

        try:
            self._client.put_object(
                Bucket=self._bucket_name,
                Key=file_key,
                Body=data,
                ContentType=content_type,
            )
            logger.info("Uploaded %d bytes to key: %s", len(data), file_key)
            return file_key
        except ClientError as e:
            logger.error("Failed to upload file bytes: %s", e)
            raise

    def download_file_bytes(self, file_key: str) -> bytes:
        """Download file content as bytes from R2.

        Args:
            file_key: The S3/R2 object key

        Returns:
            File content as bytes
        """
        if self._mock_mode:
            logger.debug("Mock download for key: %s", file_key)
            return b""

        try:
            response = self._client.get_object(
                Bucket=self._bucket_name,
                Key=file_key,
            )
            data = response["Body"].read()
            logger.debug("Downloaded %d bytes from key: %s", len(data), file_key)
            return data
        except ClientError as e:
            logger.error("Failed to download file: %s", e)
            raise

    def delete_file(self, file_key: str) -> None:
        """Delete a file from R2.

        Args:
            file_key: The S3/R2 object key to delete
        """
        if self._mock_mode:
            logger.debug("Mock delete for key: %s", file_key)
            return

        try:
            self._client.delete_object(
                Bucket=self._bucket_name,
                Key=file_key,
            )
            logger.info("Deleted key: %s", file_key)
        except ClientError as e:
            logger.error("Failed to delete file: %s", e)
            raise

    def delete_files(self, file_keys: list[str]) -> None:
        """Delete multiple files from R2 in a single batch request.

        Args:
            file_keys: List of S3/R2 object keys to delete
        """
        if not file_keys:
            return

        if self._mock_mode:
            logger.debug("Mock batch delete for %d keys", len(file_keys))
            return

        try:
            # S3 delete_objects supports up to 1000 keys per request
            for i in range(0, len(file_keys), 1000):
                batch = file_keys[i : i + 1000]
                self._client.delete_objects(
                    Bucket=self._bucket_name,
                    Delete={
                        "Objects": [{"Key": key} for key in batch],
                        "Quiet": True,
                    },
                )
            logger.info("Batch deleted %d files", len(file_keys))
        except ClientError as e:
            logger.error("Failed to batch delete files: %s", e)
            raise

    def list_files(self, prefix: str = "", max_keys: int = 1000) -> list[str]:
        """List file keys in R2 with optional prefix filter.

        Args:
            prefix: Only return keys that start with this prefix
            max_keys: Maximum number of keys to return

        Returns:
            List of file key strings
        """
        if self._mock_mode:
            logger.debug("Mock list files with prefix: %s", prefix)
            return []

        try:
            keys: list[str] = []
            paginator = self._client.get_paginator("list_objects_v2")

            for page in paginator.paginate(
                Bucket=self._bucket_name,
                Prefix=prefix,
                PaginationConfig={"MaxItems": max_keys},
            ):
                for obj in page.get("Contents", []):
                    keys.append(obj["Key"])

            logger.debug("Listed %d files with prefix: %s", len(keys), prefix)
            return keys
        except ClientError as e:
            logger.error("Failed to list files: %s", e)
            raise

    def file_exists(self, file_key: str) -> bool:
        """Check if a file exists in R2.

        Args:
            file_key: The S3/R2 object key

        Returns:
            True if the file exists, False otherwise
        """
        if self._mock_mode:
            logger.debug("Mock file_exists for key: %s", file_key)
            return False

        try:
            self._client.head_object(
                Bucket=self._bucket_name,
                Key=file_key,
            )
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            logger.error("Failed to check file existence: %s", e)
            raise

    def copy_file(self, source_key: str, dest_key: str) -> str:
        """Copy a file within the same R2 bucket (server-side copy).

        Args:
            source_key: Source object key
            dest_key: Destination object key

        Returns:
            The destination key
        """
        if self._mock_mode:
            logger.debug("Mock copy: %s -> %s", source_key, dest_key)
            return dest_key

        try:
            self._client.copy_object(
                Bucket=self._bucket_name,
                CopySource={"Bucket": self._bucket_name, "Key": source_key},
                Key=dest_key,
            )
            logger.info("Copied %s -> %s", source_key, dest_key)
            return dest_key
        except ClientError as e:
            logger.error("Failed to copy file: %s", e)
            raise

    def get_file_url(self, file_key: str) -> str:
        """Get the direct (non-presigned) URL for a file.

        Note: This URL only works if the bucket has public access enabled
        or if using a custom domain with R2.

        Args:
            file_key: The S3/R2 object key

        Returns:
            Direct URL string
        """
        settings = get_settings()
        if settings.R2_PUBLIC_URL:
            return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{file_key}"
        elif self._endpoint_url:
            return f"{self._endpoint_url}/{self._bucket_name}/{file_key}"
        else:
            return f"https://mock-r2.example.com/{self._bucket_name}/{file_key}"


# --- Singleton / Dependency Injection ---

_r2_service: Optional[R2Service] = None


def get_r2_service() -> R2Service:
    """Get or create the R2Service singleton.

    Use as a FastAPI dependency:
        r2: R2Service = Depends(get_r2_service)
    """
    global _r2_service
    if _r2_service is None:
        _r2_service = R2Service()
    return _r2_service
