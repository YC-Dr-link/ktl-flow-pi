"""device history (PI-06 등록 · 수정 이력)

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-04 22:30:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('device_history',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('device_id', sa.Integer(), nullable=False),
    sa.Column('action', sa.String(length=20), nullable=False),
    sa.Column('changes', sa.Text(), nullable=False),
    sa.Column('reason', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.String(length=40), nullable=False),
    sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('device_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_device_history_device_id'), ['device_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('device_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_device_history_device_id'))
    op.drop_table('device_history')
