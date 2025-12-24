"""
Transformation service for applying data transformations.

Handles string transformations, data type conversions, and calculated columns.
"""

import pandas as pd
from typing import Optional, Dict, Any
from simpleeval import simple_eval, NameNotDefined, InvalidExpression
import structlog

logger = structlog.get_logger()


class TransformationService:
    """Service for applying data transformations to pandas Series/DataFrames."""

    # Predefined transformations using lambda functions on pandas Series
    TRANSFORMATIONS: Dict[str, Any] = {
        'UPPER': lambda x: x.str.upper() if x.dtype == 'object' else x,
        'LOWER': lambda x: x.str.lower() if x.dtype == 'object' else x,
        'TRIM': lambda x: x.str.strip() if x.dtype == 'object' else x,
        'LTRIM': lambda x: x.str.lstrip() if x.dtype == 'object' else x,
        'RTRIM': lambda x: x.str.rstrip() if x.dtype == 'object' else x,
        'REMOVE_SPACES': lambda x: x.str.replace(' ', '') if x.dtype == 'object' else x,
        'CAPITALIZE': lambda x: x.str.capitalize() if x.dtype == 'object' else x,
        'TITLE': lambda x: x.str.title() if x.dtype == 'object' else x,
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
            transform_func = self.TRANSFORMATIONS[transformation]
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

    def evaluate_expression(
        self,
        df: pd.DataFrame,
        expression: str,
        column_name: str = "calculated"
    ) -> pd.Series:
        """
        Safely evaluate a calculated column expression.

        Args:
            df: DataFrame containing source columns
            expression: Expression to evaluate (e.g., "col_a + col_b * 2")
            column_name: Name for the resulting series

        Returns:
            pandas Series with calculated values

        Raises:
            ValueError: If expression is invalid or references unknown columns
        """
        if not expression:
            raise ValueError("Expression cannot be empty")

        # Create a safe namespace with column names as variables
        # Each column becomes a pandas Series that can be used in calculations
        namespace = {col: df[col] for col in df.columns}

        # Add common functions that are safe to use
        safe_functions = {
            'abs': abs,
            'min': min,
            'max': max,
            'round': round,
            'len': len,
            'str': str,
            'int': int,
            'float': float,
        }
        namespace.update(safe_functions)

        try:
            # Use simpleeval for safe expression evaluation
            # This prevents arbitrary code execution
            result = simple_eval(
                expression,
                names=namespace,
                functions=safe_functions
            )

            # Convert result to pandas Series if it isn't already
            if not isinstance(result, pd.Series):
                result = pd.Series([result] * len(df), name=column_name)
            else:
                result.name = column_name

            logger.info(
                "expression_evaluated",
                expression=expression,
                column_name=column_name,
                rows=len(result)
            )

            return result

        except NameNotDefined as e:
            logger.error(
                "expression_evaluation_failed",
                expression=expression,
                error="Column not found",
                details=str(e)
            )
            raise ValueError(f"Expression references unknown column: {e}")

        except InvalidExpression as e:
            logger.error(
                "expression_evaluation_failed",
                expression=expression,
                error="Invalid expression",
                details=str(e)
            )
            raise ValueError(f"Invalid expression: {e}")

        except Exception as e:
            logger.error(
                "expression_evaluation_failed",
                expression=expression,
                error=type(e).__name__,
                details=str(e)
            )
            raise ValueError(f"Failed to evaluate expression: {e}")

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
