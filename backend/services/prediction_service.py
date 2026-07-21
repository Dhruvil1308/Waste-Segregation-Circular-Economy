from datetime import datetime, timedelta
import random

class PredictionService:
    @staticmethod
    def predict_waste_generation(user_id: int):
        """
        MOCK Prediction for demo purposes.
        Returns predicted waste quantity for the next 7 days.
        """
        current_date = datetime.now()
        predictions = []
        for i in range(7):
            date = current_date + timedelta(days=i)
            # Mocking a slight fluctuation
            predicted_qty = random.uniform(10, 50) 
            predictions.append({
                "date": date.strftime("%Y-%m-%d"),
                "predicted_kg": round(predicted_qty, 2)
            })
        return predictions

    # -------------------------------------------------------------------------
    # AI/ML UPGRADE PATH
    # -------------------------------------------------------------------------
    # TODO: Time-Series Forecasting
    #
    # Goal: Predict future waste generation to help cooperatives plan capacity.
    #
    # Models:
    # - ARIMA (AutoRegressive Integrated Moving Average)
    # - LSTM (Long Short-Term Memory Neural Networks)
    # - Facebook Prophet
    #
    # Data Requirements:
    # - Historical `waste_listings` data (created_at, quantity_kg) per user.
    # -------------------------------------------------------------------------
