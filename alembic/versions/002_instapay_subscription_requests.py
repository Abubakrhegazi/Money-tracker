"""Add subscription_requests table for InstaPay manual payment flow

Revision ID: 002_instapay_sub_requests
Revises: 001_subscriptions
Create Date: 2026-04-02

"""
from alembic import op
import sqlalchemy as sa


revision = '002_instapay_sub_requests'
down_revision = '001_subscriptions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'subscription_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('telegram_user_id', sa.String(), nullable=False),
        sa.Column('requested_plan', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('pending_since', sa.DateTime(), nullable=False),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('photo_file_id', sa.String(200), nullable=True),
    )
    op.create_index('ix_sub_req_user_id', 'subscription_requests', ['telegram_user_id'])
    op.create_index('ix_sub_req_status', 'subscription_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_sub_req_status', table_name='subscription_requests')
    op.drop_index('ix_sub_req_user_id', table_name='subscription_requests')
    op.drop_table('subscription_requests')
