# app/schemas/currency_network.py
from pydantic import BaseModel

class CurrencyNetworkCreate(BaseModel):
    currency_id: int
    network_id: int