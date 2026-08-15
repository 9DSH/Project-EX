from mnemonic import Mnemonic
from eth_account import Account
import os
from dotenv import load_dotenv


# 🔥 LOAD ENV FILE
load_dotenv()

Account.enable_unaudited_hdwallet_features()

MNEMONIC = os.getenv("MASTER_MNEMONIC")


def derive_bsc_private_key(index: int):
    """
    Derive BSC (Ethereum) wallet from mnemonic
    Path: m/44'/60'/0'/0/index
    """

    if not MNEMONIC:
        raise Exception("MASTER_MNEMONIC not set")

    account = Account.from_mnemonic(
        MNEMONIC,
        account_path=f"m/44'/60'/0'/0/{index}"
    )

    return {
        "address": account.address,
        "private_key": account.key.hex()
    }


def derive_hot_wallet():
    """
    System hot wallet (execution engine)
    Derived from same mnemonic but fixed index
    """


    load_dotenv()
    Account.enable_unaudited_hdwallet_features()

    mnemonic = os.getenv("MASTER_MNEMONIC")

    if not mnemonic:
        raise Exception("MASTER_MNEMONIC not set")

    account = Account.from_mnemonic(
        mnemonic,
        account_path="m/44'/60'/0'/0/100"
    )

    return {
        "address": account.address,
        "private_key": account.key.hex()
    }