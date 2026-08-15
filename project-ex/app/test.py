import sys
import os
from app.services.key_derivation_service import derive_hot_wallet

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

print(derive_hot_wallet())