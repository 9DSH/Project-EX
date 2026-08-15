from pydantic import BaseModel

class WithdrawRequest(BaseModel):
    amount: float
    currency: str
    network: str | None = None
    wallet_address: str | None = None

class ExternalWalletRequest(BaseModel):
    currency_id: int
    network_id: int
    address: str
