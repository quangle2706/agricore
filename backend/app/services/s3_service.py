import boto3
from botocore.config import Config

from pathlib import PurePosixPath
from urllib.parse import quote

from app.config import settings

s3_client = boto3.client(
    "s3", 
    region_name=settings.aws_region,
    config=Config(
        connect_timeout=1,
        read_timeout=2,
        retries={
            "mode": "standard",
            "total_max_attempts": 1,
        },
    ),
)

def upload_file_to_s3(file, key: str) -> None:
    s3_client.upload_fileobj(file, settings.s3_bucket_name, key)

def create_presigned_download_url(key: str) -> str:
    filename = quote(PurePosixPath(key).name, safe="")
    return s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": key,
            "ResponseContentDisposition": f"attachment; filename*=UTF-8''{filename}",
        },
        ExpiresIn=3600,
    )