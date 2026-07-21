from sqlalchemy.orm import Session
from backend import models

class MatchingService:
    @staticmethod
    def calculate_score(listing: models.WasteListing, cooperative: models.User) -> float:
        """
        MVP Rule-based matching score (0-100).
        Factors:
        1. Distance (Mocked logic)
        2. Quantity match (Higher quantity = better for optimization)
        """
        
        # MOCK DISTANCE CALCULATION
        # In real app: use haversine formula on listing.location and cooperative.location
        # For demo: specific keywords in location might simulate closeness
        distance_score = 50.0 
        if listing.location.lower() == cooperative.location.lower():
            distance_score = 90.0
        
        # QUANTITY SCORE
        # Cooperatives prefer larger batches? Let's say yes for this logic.
        quantity_score = min(listing.quantity_kg, 100) # Cap at 100 for score
        
        # WEIGHTED AVERAGE
        final_score = (distance_score * 0.7) + (quantity_score * 0.3)
        return round(final_score, 2)

    @staticmethod
    def get_recommendations(listing_id: int, db: Session):
        """
        Find best matching cooperatives for a waste listing.
        """
        listing = db.query(models.WasteListing).filter(models.WasteListing.id == listing_id).first()
        if not listing:
            return []

        # Get all cooperatives
        cooperatives = db.query(models.User).filter(models.User.role == "cooperative").all()
        
        recommendations = []
        for coop in cooperatives:
            score = MatchingService.calculate_score(listing, coop)
            # Threshold for recommendation
            if score > 20: 
                recommendations.append({
                    "cooperative_id": coop.id,
                    "cooperative_name": coop.name,
                    "score": score
                })
        
        # Sort by score descending
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations

    # -------------------------------------------------------------------------
    # AI/ML UPGRADE PATH
    # -------------------------------------------------------------------------
    # TODO: Replace rule-based logic with a Supervised Learning Model.
    #
    # Proposed Model: Random Forest Regressor or XGBoost
    #
    # Input Features (X):
    # - Distance (km)
    # - Waste Quantity (kg)
    # - Waste Type (One-hot encoded: [Veg, Food, Mixed])
    # - Cooperative Capacity (kg/day)
    # - Historical Acceptance Rate (Coop's % of accepting similar offers)
    #
    # Target Variable (y):
    # - Match Success (0 or 1) OR Match Quality Score (0-100)
    #
    # Implementation Steps:
    # 1. Collect transaction data from `matches` table.
    # 2. Train model using scikit-learn.
    # 3. Serialize model using joblib/pickle.
    # 4. Load model here and predict score:
    #    score = model.predict([features])
    # -------------------------------------------------------------------------
