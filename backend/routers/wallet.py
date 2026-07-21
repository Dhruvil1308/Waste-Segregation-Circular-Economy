from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend import database, models, auth, schemas

router = APIRouter(
    prefix="/wallet",
    tags=["wallet"]
)

@router.get("/balance")
async def get_wallet_balance(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get current user's Green Credits balance.
    """
    wallet = db.query(models.Wallet).filter(models.Wallet.user_id == current_user.id).first()
    if not wallet:
        return {"balance": 0.0, "badges": []}
    
    # Parse badges (mock JSON)
    import json
    badges = json.loads(wallet.badges) if wallet.badges else []
    
    return {"balance": wallet.balance, "badges": badges}

@router.post("/redeem")
async def redeem_credits(
    amount: float,
    reason: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Spend Green Credits (Mock).
    """
    wallet = db.query(models.Wallet).filter(models.Wallet.user_id == current_user.id).first()
    if not wallet or wallet.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    wallet.balance -= amount
    
    transaction = models.CreditTransaction(
        wallet_id=wallet.id,
        amount=-amount,
        transaction_type="SPEND",
        reason=reason
    )
    db.add(transaction)
    db.commit()
    
    return {"message": f"Redeemed {amount} credits successfully", "new_balance": wallet.balance}
