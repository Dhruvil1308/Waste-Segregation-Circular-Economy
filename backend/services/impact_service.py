from backend import models

# Green credits awarded to the generator per kg collected.
POINTS_PER_KG = 10


class ImpactService:
    @staticmethod
    def calculate_impact(waste_kg: float):
        """
        MVP Formulas:
        - CO2 Saved = waste_kg * 0.5 (kg CO2e)
        - Income Generated = waste_kg * 4 (INR)
        """
        co2_saved = waste_kg * 0.5
        income_generated = waste_kg * 4.0
        return co2_saved, income_generated

    @staticmethod
    def log_pickup(db, listing) -> dict:
        """
        Records the impact of a collected pickup and credits the generator's wallet.

        Shared by the QR collection flow and the manual confirm-pickup fallback so
        the two can never drift apart on how credits are awarded.
        """
        quantity = listing.quantity_kg or 0.0
        co2, income = ImpactService.calculate_impact(quantity)

        db.add(models.ImpactLog(
            waste_listing_id=listing.id,
            waste_kg=quantity,
            co2_saved=co2,
            income_generated=income,
        ))

        points = (listing.quantity_kg or 1.0) * POINTS_PER_KG

        wallet = db.query(models.Wallet).filter(models.Wallet.user_id == listing.user_id).first()
        if not wallet:
            wallet = models.Wallet(user_id=listing.user_id, balance=0.0)
            db.add(wallet)
            db.flush()  # need the wallet id for the transaction row

        wallet.balance += points
        db.add(models.CreditTransaction(
            wallet_id=wallet.id,
            amount=points,
            transaction_type="EARN",
            reason=f"Waste Collected (Request #{listing.id})",
        ))

        db.commit()

        return {
            "impact": {"co2": co2, "income": income},
            "rewards": {"points_earned": points},
        }

    # -------------------------------------------------------------------------
    # AI/ML UPGRADE PATH
    # -------------------------------------------------------------------------
    # TODO: Advanced Regression for Impact Prediction
    #
    # Goal: More accurate CO2 and income estimation based on waste composition.
    #
    # Model: Linear Regression or Gradient Boosting
    # Features:
    # - Specific waste composition (e.g., % moisture, % carbon)
    # - Processing method used by cooperative
    # - Local market rates for compost/biogas
    # -------------------------------------------------------------------------
