
import os
from dotenv import load_dotenv

load_dotenv()

TATUM_API_KEY = os.getenv("TATUM_API_KEY")
TATUM_BASE_URL = os.getenv("TATUM_BASE_URL")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")
MASTER_WALLET_ADDRESS = os.getenv("MASTER_WALLET_ADDRESS")
MASTER_MNEMONIC = os.getenv("MASTER_MNEMONIC")
BSC_PRIVATE_KEY = os.getenv("BSC_PRIVATE_KEY")

SECRET_KEY = "super-secret-key-change-this"  # change later
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60