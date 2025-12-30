"""
Transformation service for applying data transformations.

Handles string transformations and data type conversions.
"""

import pandas as pd
from typing import Optional, Dict, Any
import structlog

logger = structlog.get_logger()


class TransformationService:
    """Service for applying data transformations to pandas Series/DataFrames."""

    # Predefined transformations with metadata
    TRANSFORMATIONS: Dict[str, Dict[str, Any]] = {
        # String Transformations
        'UPPER': {
            'func': lambda x: x.str.upper() if x.dtype == 'object' else x,
            'description': 'Convert text to UPPERCASE',
            'category': 'string',
            'params': []
        },
        'LOWER': {
            'func': lambda x: x.str.lower() if x.dtype == 'object' else x,
            'description': 'Convert text to lowercase',
            'category': 'string',
            'params': []
        },
        'TRIM': {
            'func': lambda x: x.str.strip() if x.dtype == 'object' else x,
            'description': 'Remove leading and trailing whitespace',
            'category': 'string',
            'params': []
        },
        'LTRIM': {
            'func': lambda x: x.str.lstrip() if x.dtype == 'object' else x,
            'description': 'Remove leading whitespace',
            'category': 'string',
            'params': []
        },
        'RTRIM': {
            'func': lambda x: x.str.rstrip() if x.dtype == 'object' else x,
            'description': 'Remove trailing whitespace',
            'category': 'string',
            'params': []
        },
        'REMOVE_SPACES': {
            'func': lambda x: x.str.replace(' ', '', regex=False) if x.dtype == 'object' else x,
            'description': 'Remove all spaces from text',
            'category': 'string',
            'params': []
        },
        'CAPITALIZE': {
            'func': lambda x: x.str.capitalize() if x.dtype == 'object' else x,
            'description': 'Capitalize first letter of each value',
            'category': 'string',
            'params': []
        },
        'TITLE': {
            'func': lambda x: x.str.title() if x.dtype == 'object' else x,
            'description': 'Convert To Title Case',
            'category': 'string',
            'params': []
        },
        'REVERSE': {
            'func': lambda x: x.str[::-1] if x.dtype == 'object' else x,
            'description': 'Reverse text',
            'category': 'string',
            'params': []
        },
        'LENGTH': {
            'func': lambda x: x.str.len() if x.dtype == 'object' else x,
            'description': 'Get length of text',
            'category': 'string',
            'params': []
        },

        # Date/Time Transformations
        'EXTRACT_YEAR': {
            'func': lambda x: pd.to_datetime(x, errors='coerce').dt.year,
            'description': 'Extract year from date (e.g., 2024)',
            'category': 'date',
            'params': []
        },
        'EXTRACT_MONTH': {
            'func': lambda x: pd.to_datetime(x, errors='coerce').dt.month,
            'description': 'Extract month number (1-12)',
            'category': 'date',
            'params': []
        },
        'EXTRACT_DAY': {
            'func': lambda x: pd.to_datetime(x, errors='coerce').dt.day,
            'description': 'Extract day of month (1-31)',
            'category': 'date',
            'params': []
        },
        'TODAY': {
            'func': lambda x: pd.Timestamp.today(),
            'description': 'Replace with current date',
            'category': 'date',
            'params': []
        },
        'NOW': {
            'func': lambda x: pd.Timestamp.now(),
            'description': 'Replace with current date and time',
            'category': 'date',
            'params': []
        },

        # Numeric Transformations
        'ABS': {
            'func': lambda x: x.abs() if pd.api.types.is_numeric_dtype(x) else x,
            'description': 'Get absolute value',
            'category': 'numeric',
            'params': []
        },
        'FLOOR': {
            'func': lambda x: x.apply(lambda val: int(val) if pd.notna(val) else val) if pd.api.types.is_numeric_dtype(x) else x,
            'description': 'Round down to nearest integer',
            'category': 'numeric',
            'params': []
        },
        'CEILING': {
            'func': lambda x: x.apply(lambda val: int(val) + (1 if val > int(val) else 0) if pd.notna(val) else val) if pd.api.types.is_numeric_dtype(x) else x,
            'description': 'Round up to nearest integer',
            'category': 'numeric',
            'params': []
        },

        # Null Handling
        'FILL_NULL': {
            'func': lambda x: x.fillna(''),
            'description': 'Replace null values with empty string',
            'category': 'null_handling',
            'params': []
        },
        'FILL_ZERO': {
            'func': lambda x: x.fillna(0),
            'description': 'Replace null values with zero',
            'category': 'null_handling',
            'params': []
        },
    }

    def apply_transformation(
        self,
        series: pd.Series,
        transformation: str
    ) -> pd.Series:
        """
        Apply a named transformation to a pandas Series.

        Args:
            series: The pandas Series to transform
            transformation: The transformation name (e.g., 'UPPER', 'LOWER', 'TRIM')

        Returns:
            Transformed pandas Series

        Raises:
            ValueError: If transformation is not recognized
        """
        if not transformation or transformation == 'none':
            return series

        if transformation not in self.TRANSFORMATIONS:
            raise ValueError(
                f"Unknown transformation '{transformation}'. "
                f"Available transformations: {list(self.TRANSFORMATIONS.keys())}"
            )

        try:
            transform_config = self.TRANSFORMATIONS[transformation]
            transform_func = transform_config['func']
            result = transform_func(series)

            logger.info(
                "transformation_applied",
                transformation=transformation,
                column=series.name,
                rows_affected=len(series)
            )

            return result

        except Exception as e:
            logger.error(
                "transformation_failed",
                transformation=transformation,
                column=series.name,
                error=str(e)
            )
            raise

    def apply_transformations(
        self,
        series: pd.Series,
        transformations: list
    ) -> pd.Series:
        """
        Apply multiple transformations to a pandas Series in order.

        Args:
            series: The pandas Series to transform
            transformations: List of transformation names to apply in order

        Returns:
            Transformed pandas Series

        Raises:
            ValueError: If any transformation is not recognized
        """
        if not transformations:
            return series

        result = series
        for transformation in transformations:
            result = self.apply_transformation(result, transformation)

        return result

    def convert_data_type(
        self,
        series: pd.Series,
        target_type: str
    ) -> pd.Series:
        """
        Convert pandas Series to a target data type.

        Args:
            series: The pandas Series to convert
            target_type: Target SQL data type (e.g., 'TEXT', 'INTEGER', 'NUMERIC', 'BOOLEAN', 'TIMESTAMP')

        Returns:
            Converted pandas Series

        Raises:
            ValueError: If conversion fails
        """
        type_mapping = {
            'TEXT': 'object',
            'VARCHAR': 'object',
            'CHAR': 'object',
            'INTEGER': 'Int64',  # Nullable integer
            'BIGINT': 'Int64',
            'SMALLINT': 'Int64',
            'NUMERIC': 'float64',
            'DECIMAL': 'float64',
            'FLOAT': 'float64',
            'DOUBLE': 'float64',
            'BOOLEAN': 'bool',
            'TIMESTAMP': 'datetime64[ns]',
            'DATE': 'datetime64[ns]',
            'DATETIME': 'datetime64[ns]',
        }

        pandas_type = type_mapping.get(target_type.upper())
        if not pandas_type:
            logger.warning(
                "unknown_data_type",
                target_type=target_type,
                column=series.name,
                message="Type not mapped, returning original series"
            )
            return series

        try:
            if pandas_type == 'datetime64[ns]':
                result = pd.to_datetime(series, errors='coerce')
            elif pandas_type == 'bool':
                result = series.astype('bool')
            else:
                result = series.astype(pandas_type)

            logger.info(
                "data_type_converted",
                column=series.name,
                from_type=str(series.dtype),
                to_type=target_type,
                rows=len(series)
            )

            return result

        except Exception as e:
            logger.error(
                "data_type_conversion_failed",
                column=series.name,
                target_type=target_type,
                error=str(e)
            )
            raise ValueError(
                f"Failed to convert column '{series.name}' to {target_type}: {e}"
            )


# Singleton instance
transformation_service = TransformationService()
