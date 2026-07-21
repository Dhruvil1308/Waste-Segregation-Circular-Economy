
CHATBOT_FLOWS = {
    "GIVE_WASTE": {
        1: {
            "question": "What type of waste do you have?",
            "field": "waste_type",
            "options": [
                "Cooked Food",
                "Raw Vegetables",
                "Fruit Waste",
                "Mixed Organic"
            ]
        },
        2: {
            "question": "Approximate quantity?",
            "field": "quantity",
            "options": [
                "<5 kg",
                "5-10 kg",
                ">10 kg"
            ]
        },
        3: {
            "question": "Preferred pickup time?",
            "field": "pickup_time",
            "options": [
                "Morning",
                "Afternoon",
                "Evening"
            ]
        }
    },
    "FIND_WASTE": {
        1: {
            "question": "What do you want to process?",
            "field": "processing_method",
            "options": [
                "Compost",
                "Biogas"
            ]
        },
        2: {
            "question": "Preferred waste category?",
            "field": "waste_category",
            "options": [
                "Raw Vegetables",
                "Cooked Food",
                "Fruit Waste",
                "Mixed Organic"
            ]
        },
        3: {
            "question": "Maximum distance?",
            "field": "max_distance",
            "options": [
                "5 km",
                "10 km"
            ]
        }
    }
}
