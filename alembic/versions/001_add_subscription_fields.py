"""Add subscription fields to user_settings

Revision ID: 001_subscriptions
Revises:
Create Date: 2026-03-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_subscriptions'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add subscription columns to user_settings table
    # These are idempotent — the runtime init_db() migration also handles this,
    # but this Alembic migration is the canonical source of truth.
    with op.batch_alter_table('user_settings') as batch_op:
        batch_op.add_column(sa.Column('plan', sa.String(10), server_default='free', nullable=False))
        batch_op.add_column(sa.Column('plan_expires_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('trial_ends_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('paymob_order_id', sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_settings') as batch_op:
        batch_op.drop_column('paymob_order_id')
        batch_op.drop_column('trial_ends_at')
        batch_op.drop_column('plan_expires_at')
        batch_op.drop_column('plan')
