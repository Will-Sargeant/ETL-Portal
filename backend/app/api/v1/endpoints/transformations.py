"""
API endpoints for transformation operations.
"""
from fastapi import APIRouter
from typing import List, Dict, Any

from app.services.transformation_service import transformation_service

router = APIRouter()


@router.get("/", response_model=List[Dict[str, Any]])
async def list_transformations():
    """
    Get all available transformations with their metadata.

    Returns a list of transformations grouped by category with descriptions.
    """
    transformations = []

    for name, config in transformation_service.TRANSFORMATIONS.items():
        transformations.append({
            'name': name,
            'description': config['description'],
            'category': config['category'],
            'params': config.get('params', [])
        })

    return transformations


@router.get("/categories", response_model=Dict[str, List[Dict[str, Any]]])
async def list_transformations_by_category():
    """
    Get all available transformations grouped by category.

    Returns transformations organized by category for UI display.
    """
    categories = {}

    for name, config in transformation_service.TRANSFORMATIONS.items():
        category = config['category']

        if category not in categories:
            categories[category] = []

        categories[category].append({
            'name': name,
            'description': config['description'],
            'params': config.get('params', [])
        })

    return categories
