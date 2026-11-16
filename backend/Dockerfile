FROM python:3.11-slim

WORKDIR /app

# Upgrade pip first
RUN pip install --upgrade pip

# Pre-install the tiny packages that consistently fail last due to connection drops.
# These are isolated so a retry only re-runs this one fast step (< 1 MB total).
RUN pip install --no-cache-dir mdurl==0.1.2 markdown-it-py==3.0.0 pygments==2.18.0

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 300 -r requirements.txt

COPY . .

# Run migrations then start the server.
# ML model is pre-trained (app/ml/outputs/best_model.joblib is committed).
# To retrain: docker compose exec backend python -m app.ml.train
# NOTE: if ML inference fails after a fresh build, the model pickle references
# imblearn — ensure imbalanced-learn is in requirements.txt (it is).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
