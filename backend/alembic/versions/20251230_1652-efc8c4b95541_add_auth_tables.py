"""add_auth_tables

Revision ID: efc8c4b95541
Revises: e1d64e46e1d0
Create Date: 2025-12-30 16:52:21.271867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efc8c4b95541'
down_revision: Union[str, None] = 'e1d64e46e1d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create authentication tables and add user ownership to existing tables."""

    # Create UserRole enum (if not exists)
    op.execute("DO $$ BEGIN CREATE TYPE userrole AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create AuthProvider enum (if not exists)
    op.execute("DO $$ BEGIN CREATE TYPE authprovider AS ENUM ('local', 'google', 'saml'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='user'),
        sa.Column('auth_provider', sa.String(length=50), nullable=False),
        sa.Column('provider_user_id', sa.String(length=255), nullable=True),
        sa.Column('profile_picture_url', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('auth_provider', 'provider_user_id', name='uq_auth_provider_user_id')
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_role', 'users', ['role'])
    op.create_index('idx_users_is_active', 'users', ['is_active'])

    # Create refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=500), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('device_info', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index('idx_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('idx_refresh_tokens_token', 'refresh_tokens', ['token'])
    op.create_index('idx_refresh_tokens_expires_at', 'refresh_tokens', ['expires_at'])

    # Create saml_configs table
    op.create_table(
        'saml_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_id', sa.String(length=500), nullable=False),
        sa.Column('sso_url', sa.String(length=500), nullable=False),
        sa.Column('x509_cert', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )

    # Add user_id to credentials table
    op.add_column('credentials', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_credentials_user_id', 'credentials', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_index('idx_credentials_user_id', 'credentials', ['user_id'])

    # Add user_id to etl_jobs table
    op.add_column('etl_jobs', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_etl_jobs_user_id', 'etl_jobs', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_etl_jobs_user_id', 'etl_jobs', ['user_id'])


def downgrade() -> None:
    """Remove authentication tables and user ownership columns."""

    # Remove user_id from etl_jobs
    op.drop_index('idx_etl_jobs_user_id', 'etl_jobs')
    op.drop_constraint('fk_etl_jobs_user_id', 'etl_jobs', type_='foreignkey')
    op.drop_column('etl_jobs', 'user_id')

    # Remove user_id from credentials
    op.drop_index('idx_credentials_user_id', 'credentials')
    op.drop_constraint('fk_credentials_user_id', 'credentials', type_='foreignkey')
    op.drop_column('credentials', 'user_id')

    # Drop tables
    op.drop_table('saml_configs')

    op.drop_index('idx_refresh_tokens_expires_at', 'refresh_tokens')
    op.drop_index('idx_refresh_tokens_token', 'refresh_tokens')
    op.drop_index('idx_refresh_tokens_user_id', 'refresh_tokens')
    op.drop_table('refresh_tokens')

    op.drop_index('idx_users_is_active', 'users')
    op.drop_index('idx_users_role', 'users')
    op.drop_index('idx_users_email', 'users')
    op.drop_table('users')

    # Drop enums
    op.execute('DROP TYPE authprovider')
    op.execute('DROP TYPE userrole')
