import sys
import boto3
from botocore.exceptions import ClientError
from app import config as C

def create_table():
    opts = {}
    if C.DDB_ENDPOINT_URL:
        opts["endpoint_url"] = C.DDB_ENDPOINT_URL
    
    dynamodb = boto3.client("dynamodb", **opts)
    table_name = C.DDB_TABLE_NAME
    
    try:
        print(f"Creating table {table_name}...")
        dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
                {"AttributeName": "gsi1pk", "AttributeType": "S"},
                {"AttributeName": "gsi1sk", "AttributeType": "S"}
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "gsi1",
                    "KeySchema": [
                        {"AttributeName": "gsi1pk", "KeyType": "HASH"},
                        {"AttributeName": "gsi1sk", "KeyType": "RANGE"}
                    ],
                    "Projection": {"ProjectionType": "ALL"}
                }
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        print("Waiting for table to become active...")
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(TableName=table_name)
        print("Table created and active.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Table {table_name} already exists.")
        else:
            raise

    # Enable TTL
    try:
        print("Enabling TTL on attribute 'ttl'...")
        dynamodb.update_time_to_live(
            TableName=table_name,
            TimeToLiveSpecification={
                'Enabled': True,
                'AttributeName': 'ttl'
            }
        )
        print("TTL enabled.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ValidationException' and 'already' in e.response['Error']['Message'].lower():
            print("TTL is already enabled.")
        else:
            raise

if __name__ == "__main__":
    create_table()
