
# Waste Category -> Processing Mapping
# Used for validating if a chosen waste category supports the desired processing method.

WASTE_CATEGORY_MAPPING = {
    "Raw Vegetables": {"compost": True, "biogas": True},
    "Cooked Food":    {"compost": False, "biogas": True},
    "Fruit Waste":    {"compost": True, "biogas": False},
    "Mixed Organic":  {"compost": True, "biogas": True} # 'conditional' treated as True for discovery
}

def is_compatible(waste_category: str, method: str) -> bool:
    """
    Checks if the waste category supports the processing method (compost/biogas).
    """
    props = WASTE_CATEGORY_MAPPING.get(waste_category)
    if not props:
        return False # Unknown category
    
    # method should be 'Compost' or 'Biogas' (case insensitive normalization needed usually)
    method_key = method.lower()
    return props.get(method_key, False)
