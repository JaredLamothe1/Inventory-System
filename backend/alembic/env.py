from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from app.models.category import Category
from app.models.product import Product
from app.models.sale import Sale
from app.models.user import User
from app.models.purchase_tier import PurchaseTier
from app.models.password_reset import PasswordReset
from app.models.product_collection import ProductCollection
from app.models.purchase_order import PurchaseOrder
# Import your Base
from app.database import Base  # This matches your project structure

# Alembic Config object
config = context.config

# Logging setup
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Tell Alembic about your models' metadata
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
