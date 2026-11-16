"""
DTMS — Dropout Prediction Model Training Pipeline

Models trained:
  1. Logistic Regression    (baseline)
  2. Random Forest          (tuned via RandomizedSearchCV)
  3. XGBoost                (tuned via RandomizedSearchCV)
  4. LightGBM               (tuned via RandomizedSearchCV)
  5. Stacking Ensemble      (RF + XGB + LGB → LR meta-learner)

Evaluation:
  - 5-fold Stratified Cross-Validation with confidence intervals (mean ± std)
  - Threshold optimization via Precision-Recall curve (maximise F1 on dropout class)
  - ROC-AUC, PR-AUC, F1 (macro), Recall, Precision (dropout class)
  - Brier Score (calibration quality)
  - Confusion Matrix (CV + test set)
  - Calibration Curve
  - SHAP feature importance (best model + cross-model comparison)

Outputs saved to: backend/app/ml/outputs/
  - best_model.joblib        best performing model pipeline
  - all_models.joblib        all trained pipelines
  - evaluation_report.json   full metrics with confidence intervals
  - plots/                   all evaluation plots
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import shap

from pathlib import Path
from datetime import datetime

from sklearn.model_selection import (
    train_test_split, StratifiedKFold,
    cross_val_predict, RandomizedSearchCV,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, StackingClassifier
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score,
    precision_score, recall_score, confusion_matrix,
    roc_curve, precision_recall_curve, classification_report,
    brier_score_loss,
)
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from app.ml.data_generator import generate_dataset, get_feature_names

warnings.filterwarnings('ignore')

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "outputs"
PLOTS_DIR  = OUTPUT_DIR / "plots"
OUTPUT_DIR.mkdir(exist_ok=True)
PLOTS_DIR.mkdir(exist_ok=True)

SEED          = 42
FEATURE_NAMES = get_feature_names()

# ── Plot styling ───────────────────────────────────────────────────────────────
plt.rcParams.update({
    'figure.facecolor': 'white',
    'axes.facecolor':   'white',
    'axes.grid':        True,
    'grid.alpha':       0.3,
    'font.size':        11,
})
PALETTE = {
    'Logistic Regression': '#64748B',
    'Random Forest':       '#10B981',
    'XGBoost':             '#0EA5E9',
    'LightGBM':            '#8B5CF6',
    'Stacking Ensemble':   '#F59E0B',
}


# ── Data ───────────────────────────────────────────────────────────────────────
def load_data(n_samples: int = 1000):
    df = generate_dataset(n_samples)
    X  = df[FEATURE_NAMES]
    y  = df['dropout']
    return X, y


# ── Threshold optimization ────────────────────────────────────────────────────
def find_optimal_threshold(y_true, y_prob):
    """Find threshold that maximises F1 score on the dropout class."""
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)
    f1_scores = np.where(
        (precisions + recalls) == 0, 0,
        2 * precisions * recalls / (precisions + recalls)
    )
    best_idx = np.argmax(f1_scores[:-1])
    return round(float(thresholds[best_idx]), 3), round(float(f1_scores[best_idx]), 4)


# ── Hyperparameter search spaces ───────────────────────────────────────────────
def get_param_grids():
    return {
        'Random Forest': {
            'model__n_estimators':    [100, 200, 300, 500],
            'model__max_depth':       [5, 8, 10, 15, None],
            'model__min_samples_split': [2, 5, 10],
            'model__min_samples_leaf':  [1, 2, 4],
            'model__max_features':    ['sqrt', 'log2', 0.5],
        },
        'XGBoost': {
            'model__n_estimators':    [100, 200, 300],
            'model__max_depth':       [3, 4, 5, 6, 7],
            'model__learning_rate':   [0.01, 0.05, 0.1, 0.2],
            'model__subsample':       [0.6, 0.8, 1.0],
            'model__colsample_bytree': [0.6, 0.8, 1.0],
            'model__reg_alpha':       [0, 0.1, 0.5, 1.0],
            'model__reg_lambda':      [1.0, 1.5, 2.0],
        },
        'LightGBM': {
            'model__n_estimators':    [100, 200, 300],
            'model__max_depth':       [3, 5, 7, -1],
            'model__learning_rate':   [0.01, 0.05, 0.1, 0.2],
            'model__num_leaves':      [15, 31, 63],
            'model__subsample':       [0.6, 0.8, 1.0],
            'model__colsample_bytree': [0.6, 0.8, 1.0],
            'model__min_child_samples': [5, 10, 20],
        },
    }


# ── Base model definitions ─────────────────────────────────────────────────────
def build_base_models():
    return {
        'Logistic Regression': LogisticRegression(
            C=1.0, solver='lbfgs', max_iter=1000,
            class_weight='balanced', random_state=SEED,
        ),
        'Random Forest': RandomForestClassifier(
            n_estimators=300, class_weight='balanced',
            random_state=SEED, n_jobs=-1,
        ),
        'XGBoost': XGBClassifier(
            scale_pos_weight=4, use_label_encoder=False,
            eval_metric='logloss', random_state=SEED, verbosity=0,
        ),
        'LightGBM': LGBMClassifier(
            class_weight='balanced', random_state=SEED, verbose=-1,
        ),
    }


def build_pipeline(model):
    return ImbPipeline([
        ('scaler', StandardScaler()),
        ('smote',  SMOTE(random_state=SEED, k_neighbors=5)),
        ('model',  model),
    ])


# ── Hyperparameter tuning ──────────────────────────────────────────────────────
def tune_model(name, model, X_train, y_train):
    """Run RandomizedSearchCV for models that have a search space defined."""
    param_grids = get_param_grids()
    if name not in param_grids:
        return model  # Logistic Regression — no tuning needed

    pipeline = build_pipeline(model)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_grids[name],
        n_iter=20,
        scoring='roc_auc',
        cv=skf,
        random_state=SEED,
        n_jobs=-1,
        refit=True,
    )
    search.fit(X_train, y_train)
    best_params = {k.replace('model__', ''): v for k, v in search.best_params_.items()}
    print(f"        Best params: {best_params}")
    print(f"        Best CV ROC-AUC: {search.best_score_:.4f}")
    return search.best_estimator_.named_steps['model']


# ── Cross-validation with confidence intervals ─────────────────────────────────
def evaluate_cv(model, X, y, cv=5):
    """
    5-fold CV returning mean ± std for all metrics.
    Uses OOF predictions for aggregate curves, per-fold metrics for CI.
    """
    skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=SEED)
    pipeline = build_pipeline(model)

    # OOF predictions for aggregate ROC/PR curves
    y_prob_oof = cross_val_predict(pipeline, X, y, cv=skf, method='predict_proba', n_jobs=-1)[:, 1]

    # Per-fold metrics for confidence intervals
    fold_metrics = {
        'roc_auc': [], 'pr_auc': [], 'f1_macro': [],
        'recall_dropout': [], 'precision_dropout': [], 'brier_score': [],
    }

    for train_idx, val_idx in skf.split(X, y):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

        pipe = build_pipeline(model)
        pipe.fit(X_tr, y_tr)
        prob = pipe.predict_proba(X_val)[:, 1]
        pred = (prob >= 0.5).astype(int)

        fold_metrics['roc_auc'].append(roc_auc_score(y_val, prob))
        fold_metrics['pr_auc'].append(average_precision_score(y_val, prob))
        fold_metrics['f1_macro'].append(f1_score(y_val, pred, average='macro'))
        fold_metrics['recall_dropout'].append(recall_score(y_val, pred, pos_label=1))
        fold_metrics['precision_dropout'].append(precision_score(y_val, pred, pos_label=1, zero_division=0))
        fold_metrics['brier_score'].append(brier_score_loss(y_val, prob))

    # Aggregate: mean ± std
    metrics = {}
    metrics_ci = {}
    for key, vals in fold_metrics.items():
        arr = np.array(vals)
        metrics[key]    = round(float(arr.mean()), 4)
        metrics_ci[key] = {
            'mean': round(float(arr.mean()), 4),
            'std':  round(float(arr.std()), 4),
            'ci95': [round(float(arr.mean() - 1.96 * arr.std()), 4),
                     round(float(arr.mean() + 1.96 * arr.std()), 4)],
        }

    # Optimal threshold from OOF
    opt_threshold, opt_f1 = find_optimal_threshold(y, y_prob_oof)
    y_pred_oof = (y_prob_oof >= opt_threshold).astype(int)

    metrics['optimal_threshold'] = opt_threshold
    metrics['f1_at_optimal_threshold'] = opt_f1

    return metrics, metrics_ci, y_prob_oof, y_pred_oof


# ── Plots ──────────────────────────────────────────────────────────────────────
def plot_roc_curves(results, y):
    fig, ax = plt.subplots(figsize=(8, 6))
    for name, data in results.items():
        fpr, tpr, _ = roc_curve(y, data['y_prob'])
        ci = data['metrics_ci']['roc_auc']
        label = f"{name} (AUC={ci['mean']:.3f} ± {ci['std']:.3f})"
        ax.plot(fpr, tpr, label=label, color=PALETTE[name], linewidth=2)
    ax.plot([0,1],[0,1],'k--', linewidth=1, alpha=0.5, label='Random')
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title('ROC Curves — All Models (5-fold CV)', fontsize=13, fontweight='bold')
    ax.legend(loc='lower right', fontsize=8)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'roc_curves.png', dpi=150)
    plt.close()
    print("  ✓ ROC curves saved")


def plot_pr_curves(results, y):
    fig, ax = plt.subplots(figsize=(8, 6))
    baseline = y.mean()
    ax.axhline(baseline, color='k', linestyle='--', linewidth=1, alpha=0.5,
               label=f'Baseline (prevalence={baseline:.2f})')
    for name, data in results.items():
        prec, rec, _ = precision_recall_curve(y, data['y_prob'])
        ci = data['metrics_ci']['pr_auc']
        label = f"{name} (AP={ci['mean']:.3f} ± {ci['std']:.3f})"
        ax.plot(rec, prec, label=label, color=PALETTE[name], linewidth=2)
    ax.set_xlabel('Recall')
    ax.set_ylabel('Precision')
    ax.set_title('Precision-Recall Curves — All Models (5-fold CV)', fontsize=13, fontweight='bold')
    ax.legend(loc='upper right', fontsize=8)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'pr_curves.png', dpi=150)
    plt.close()
    print("  ✓ PR curves saved")


def plot_metrics_comparison_ci(results):
    """Bar chart with error bars showing mean ± std for each metric."""
    metrics_to_plot = ['roc_auc', 'pr_auc', 'f1_macro', 'recall_dropout', 'precision_dropout']
    metric_labels   = ['ROC-AUC', 'PR-AUC', 'F1 Macro', 'Recall\n(Dropout)', 'Precision\n(Dropout)']

    x     = np.arange(len(metrics_to_plot))
    width = 0.15

    fig, ax = plt.subplots(figsize=(14, 6))
    for i, (name, data) in enumerate(results.items()):
        means = [data['metrics_ci'][m]['mean'] for m in metrics_to_plot]
        stds  = [data['metrics_ci'][m]['std']  for m in metrics_to_plot]
        ax.bar(x + i * width, means, width, label=name,
               color=PALETTE[name], alpha=0.85,
               yerr=stds, capsize=3, error_kw={'linewidth': 1.2})

    ax.set_xticks(x + width * 2)
    ax.set_xticklabels(metric_labels)
    ax.set_ylabel('Score')
    ax.set_ylim(0, 1.15)
    ax.set_title('Model Comparison — Mean ± Std (5-fold CV)', fontsize=13, fontweight='bold')
    ax.legend(fontsize=9)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'model_comparison.png', dpi=150)
    plt.close()
    print("  ✓ Model comparison chart saved (with confidence intervals)")


def plot_confusion_matrix(y, y_pred, model_name):
    cm = confusion_matrix(y, y_pred)
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
                xticklabels=['Completed', 'Dropped'],
                yticklabels=['Completed', 'Dropped'])
    ax.set_ylabel('Actual')
    ax.set_xlabel('Predicted')
    ax.set_title(f'Confusion Matrix — {model_name}', fontsize=12, fontweight='bold')
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / f'confusion_matrix_{model_name.replace(" ", "_").lower()}.png', dpi=150)
    plt.close()
    print(f"  ✓ Confusion matrix saved ({model_name})")


def plot_calibration(results, y):
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot([0,1],[0,1],'k--', linewidth=1, alpha=0.5, label='Perfect calibration')
    for name, data in results.items():
        prob_true, prob_pred = calibration_curve(y, data['y_prob'], n_bins=10)
        ax.plot(prob_pred, prob_true, 's-', label=name,
                color=PALETTE[name], linewidth=2, markersize=5)
    ax.set_xlabel('Mean Predicted Probability')
    ax.set_ylabel('Fraction of Positives')
    ax.set_title('Calibration Curves (5-fold CV OOF)', fontsize=13, fontweight='bold')
    ax.legend(fontsize=9)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'calibration_curves.png', dpi=150)
    plt.close()
    print("  ✓ Calibration curves saved")


def plot_threshold_analysis(results, y):
    """Show F1 vs threshold for each model to justify optimal threshold choice."""
    fig, ax = plt.subplots(figsize=(9, 5))
    for name, data in results.items():
        prec, rec, thresholds = precision_recall_curve(y, data['y_prob'])
        f1s = np.where(
            (prec + rec) == 0, 0,
            2 * prec * rec / (prec + rec)
        )
        ax.plot(thresholds, f1s[:-1], label=name, color=PALETTE[name], linewidth=2)
        opt = data['metrics']['optimal_threshold']
        ax.axvline(opt, color=PALETTE[name], linestyle=':', linewidth=1, alpha=0.6)

    ax.set_xlabel('Decision Threshold')
    ax.set_ylabel('F1 Score (Dropout Class)')
    ax.set_title('F1 vs. Decision Threshold — Optimal Threshold Selection',
                 fontsize=12, fontweight='bold')
    ax.legend(fontsize=9)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'threshold_analysis.png', dpi=150)
    plt.close()
    print("  ✓ Threshold analysis saved")


def plot_feature_importance_comparison(trained_pipelines, X_test):
    """Compare feature importances across tree-based models."""
    tree_models = {k: v for k, v in trained_pipelines.items()
                   if k in ('Random Forest', 'XGBoost', 'LightGBM')}
    if not tree_models:
        return

    fig, axes = plt.subplots(1, len(tree_models), figsize=(5 * len(tree_models), 7), sharey=True)
    if len(tree_models) == 1:
        axes = [axes]

    for ax, (name, pipeline) in zip(axes, tree_models.items()):
        model = pipeline.named_steps['model']
        importances = model.feature_importances_
        sorted_idx = np.argsort(importances)
        ax.barh(
            [FEATURE_NAMES[i] for i in sorted_idx],
            importances[sorted_idx],
            color=PALETTE[name], alpha=0.85,
        )
        ax.set_title(name, fontweight='bold', fontsize=11)
        ax.set_xlabel('Importance')

    plt.suptitle('Feature Importance Comparison — Tree Models',
                 fontsize=13, fontweight='bold', y=1.01)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'feature_importance_comparison.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✓ Feature importance comparison saved")


def plot_shap(best_pipeline, X_test, model_name):
    try:
        fitted_model = best_pipeline.named_steps['model']
        scaler       = best_pipeline.named_steps['scaler']
        X_scaled     = pd.DataFrame(scaler.transform(X_test), columns=X_test.columns)

        if any(m in model_name for m in ('XGBoost', 'LightGBM', 'Forest')):
            explainer  = shap.TreeExplainer(fitted_model)
            shap_vals  = explainer.shap_values(X_scaled)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[1]
        else:
            explainer = shap.LinearExplainer(fitted_model, X_scaled)
            shap_vals = explainer.shap_values(X_scaled)

        # Bar plot
        fig, _ = plt.subplots(figsize=(9, 6))
        shap.summary_plot(shap_vals, X_scaled, plot_type='bar',
                         feature_names=FEATURE_NAMES, show=False, color='#0EA5E9')
        plt.title(f'SHAP Feature Importance — {model_name}', fontsize=12, fontweight='bold')
        plt.tight_layout()
        fig.savefig(PLOTS_DIR / 'shap_importance.png', dpi=150, bbox_inches='tight')
        plt.close()

        # Summary dot plot
        fig2, _ = plt.subplots(figsize=(9, 6))
        shap.summary_plot(shap_vals, X_scaled, feature_names=FEATURE_NAMES, show=False)
        plt.title(f'SHAP Summary — {model_name}', fontsize=12, fontweight='bold')
        plt.tight_layout()
        fig2.savefig(PLOTS_DIR / 'shap_summary.png', dpi=150, bbox_inches='tight')
        plt.close()

        print(f"  ✓ SHAP plots saved ({model_name})")
    except Exception as e:
        print(f"  ⚠ SHAP skipped: {e}")


def plot_class_distribution(y):
    fig, ax = plt.subplots(figsize=(5, 4))
    counts = y.value_counts()
    bars = ax.bar(['Completed (0)', 'Dropped (1)'], counts.values,
                  color=['#10B981', '#F87171'], alpha=0.85, edgecolor='white', linewidth=1.5)
    for bar, count in zip(bars, counts.values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5,
                f'{count}\n({count/len(y):.1%})', ha='center', va='bottom', fontweight='bold')
    ax.set_title('Class Distribution', fontsize=12, fontweight='bold')
    ax.set_ylabel('Count')
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'class_distribution.png', dpi=150)
    plt.close()
    print("  ✓ Class distribution saved")


def plot_feature_correlation(X, y):
    df_plot      = X.copy()
    df_plot['dropout'] = y.values
    corr         = df_plot.corr()
    fig, ax      = plt.subplots(figsize=(11, 9))
    mask         = np.triu(np.ones_like(corr, dtype=bool))
    sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdYlGn',
                center=0, square=True, ax=ax, annot_kws={'size': 8})
    ax.set_title('Feature Correlation Matrix', fontsize=13, fontweight='bold')
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'correlation_matrix.png', dpi=150)
    plt.close()
    print("  ✓ Correlation matrix saved")


def plot_feature_distributions(X, y):
    key_features = ['att_rate', 'grade_avg', 'submission_rate',
                    'att_trend', 'grade_trend', 'comp_request_count']
    fig, axes = plt.subplots(2, 3, figsize=(14, 8))
    axes = axes.flatten()
    for i, feat in enumerate(key_features):
        ax = axes[i]
        ax.hist(X[feat][y == 0], bins=30, alpha=0.6, color='#10B981', label='Completed', density=True)
        ax.hist(X[feat][y == 1], bins=30, alpha=0.6, color='#F87171', label='Dropped',   density=True)
        ax.set_title(feat, fontweight='bold')
        ax.legend(fontsize=8)
    plt.suptitle('Feature Distributions by Dropout Status', fontsize=13, fontweight='bold', y=1.01)
    plt.tight_layout()
    fig.savefig(PLOTS_DIR / 'feature_distributions.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✓ Feature distributions saved")


# ── Main ───────────────────────────────────────────────────────────────────────
def train():
    print("\n" + "="*60)
    print("  DTMS — Dropout Prediction Model Training")
    print("="*60)

    # ── 1. Data ────────────────────────────────────────────────────────────────
    print("\n[1/7] Generating synthetic dataset...")
    X, y = load_data(n_samples=1000)
    print(f"      Samples: {len(X)} | Dropout rate: {y.mean():.1%}")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )
    print(f"      Train: {len(X_train)} | Test: {len(X_test)}")

    # ── 2. EDA ────────────────────────────────────────────────────────────────
    print("\n[2/7] Generating EDA plots...")
    plot_class_distribution(y)
    plot_feature_correlation(X, y)
    plot_feature_distributions(X, y)

    # ── 3. Hyperparameter tuning ──────────────────────────────────────────────
    print("\n[3/7] Hyperparameter tuning (RandomizedSearchCV, 20 iterations each)...")
    base_models  = build_base_models()
    tuned_models = {}
    for name, model in base_models.items():
        print(f"      → Tuning {name}...")
        tuned_models[name] = tune_model(name, model, X_train, y_train)

    # Add Stacking Ensemble using tuned base learners
    tuned_models['Stacking Ensemble'] = StackingClassifier(
        estimators=[
            ('rf',  tuned_models['Random Forest']),
            ('xgb', tuned_models['XGBoost']),
            ('lgb', tuned_models['LightGBM']),
        ],
        final_estimator=LogisticRegression(C=1.0, class_weight='balanced', random_state=SEED),
        cv=5, passthrough=False, n_jobs=-1,
    )

    # ── 4. Cross-validation with confidence intervals ──────────────────────────
    print("\n[4/7] Running 5-fold CV with confidence intervals...")
    results = {}
    for name, model in tuned_models.items():
        print(f"      → {name}...")
        metrics, metrics_ci, y_prob, y_pred = evaluate_cv(model, X_train, y_train, cv=5)
        results[name] = {
            'metrics':    metrics,
            'metrics_ci': metrics_ci,
            'y_prob':     y_prob,
            'y_pred':     y_pred,
        }
        ci = metrics_ci['roc_auc']
        print(f"        ROC-AUC={ci['mean']:.3f} ± {ci['std']:.3f} | "
              f"PR-AUC={metrics_ci['pr_auc']['mean']:.3f} | "
              f"F1={metrics_ci['f1_macro']['mean']:.3f} | "
              f"Recall={metrics_ci['recall_dropout']['mean']:.3f} | "
              f"Opt.Threshold={metrics['optimal_threshold']:.2f}")

    # ── 5. Evaluation plots ────────────────────────────────────────────────────
    print("\n[5/7] Generating evaluation plots...")
    plot_roc_curves(results, y_train)
    plot_pr_curves(results, y_train)
    plot_metrics_comparison_ci(results)
    plot_calibration(results, y_train)
    plot_threshold_analysis(results, y_train)
    for name, data in results.items():
        plot_confusion_matrix(y_train, data['y_pred'], name)

    # ── 6. Best model on test set ──────────────────────────────────────────────
    print("\n[6/7] Selecting best model and evaluating on test set...")
    best_name = max(results, key=lambda n: results[n]['metrics_ci']['roc_auc']['mean'])
    print(f"      Best model: {best_name} "
          f"(ROC-AUC={results[best_name]['metrics_ci']['roc_auc']['mean']:.3f} "
          f"± {results[best_name]['metrics_ci']['roc_auc']['std']:.3f})")

    best_pipeline = build_pipeline(tuned_models[best_name])
    best_pipeline.fit(X_train, y_train)

    y_test_prob = best_pipeline.predict_proba(X_test)[:, 1]

    # Use optimal threshold from CV
    opt_thresh = results[best_name]['metrics']['optimal_threshold']
    y_test_pred_opt = (y_test_prob >= opt_thresh).astype(int)
    y_test_pred_def = (y_test_prob >= 0.50).astype(int)

    test_metrics = {
        'threshold_default': {
            'threshold':         0.50,
            'roc_auc':           round(roc_auc_score(y_test, y_test_prob), 4),
            'pr_auc':            round(average_precision_score(y_test, y_test_prob), 4),
            'f1_macro':          round(f1_score(y_test, y_test_pred_def, average='macro'), 4),
            'recall_dropout':    round(recall_score(y_test, y_test_pred_def, pos_label=1), 4),
            'precision_dropout': round(precision_score(y_test, y_test_pred_def, pos_label=1, zero_division=0), 4),
            'brier_score':       round(brier_score_loss(y_test, y_test_prob), 4),
        },
        'threshold_optimal': {
            'threshold':         opt_thresh,
            'roc_auc':           round(roc_auc_score(y_test, y_test_prob), 4),
            'pr_auc':            round(average_precision_score(y_test, y_test_prob), 4),
            'f1_macro':          round(f1_score(y_test, y_test_pred_opt, average='macro'), 4),
            'recall_dropout':    round(recall_score(y_test, y_test_pred_opt, pos_label=1), 4),
            'precision_dropout': round(precision_score(y_test, y_test_pred_opt, pos_label=1, zero_division=0), 4),
            'brier_score':       round(brier_score_loss(y_test, y_test_prob), 4),
        },
    }

    print(f"\n      Test set — default threshold (0.50):")
    for k, v in test_metrics['threshold_default'].items():
        print(f"        {k}: {v}")
    print(f"\n      Test set — optimal threshold ({opt_thresh}):")
    for k, v in test_metrics['threshold_optimal'].items():
        print(f"        {k}: {v}")

    print(f"\n      Classification Report (optimal threshold):")
    print(classification_report(y_test, y_test_pred_opt, target_names=['Completed', 'Dropped']))

    plot_confusion_matrix(y_test, y_test_pred_opt, f"{best_name} (Test Set — Optimal Threshold)")

    # Train all pipelines for feature importance + saving
    print("\n      Training all final pipelines on full training set...")
    trained_pipelines = {}
    for name, model in tuned_models.items():
        p = build_pipeline(model)
        p.fit(X_train, y_train)
        trained_pipelines[name] = p

    plot_feature_importance_comparison(trained_pipelines, X_test)

    print("\n      Generating SHAP explanations...")
    plot_shap(trained_pipelines[best_name], X_test, best_name)

    # ── 7. Save ────────────────────────────────────────────────────────────────
    print("\n[7/7] Saving model and report...")
    joblib.dump(trained_pipelines[best_name], OUTPUT_DIR / 'best_model.joblib')
    joblib.dump(trained_pipelines,            OUTPUT_DIR / 'all_models.joblib')
    print("      ✓ Models saved")

    report = {
        'generated_at':      datetime.now().isoformat(),
        'n_samples':         len(X),
        'dropout_rate':      round(float(y.mean()), 4),
        'best_model':        best_name,
        'optimal_threshold': opt_thresh,
        'cv_results': {
            name: {
                'metrics':    data['metrics'],
                'metrics_ci': data['metrics_ci'],
            }
            for name, data in results.items()
        },
        'test_results':  test_metrics,
        'feature_names': FEATURE_NAMES,
    }
    with open(OUTPUT_DIR / 'evaluation_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    print("      ✓ Evaluation report saved → outputs/evaluation_report.json")

    print("\n" + "="*60)
    print(f"  Training complete! Best model: {best_name}")
    print(f"  ROC-AUC (test): {test_metrics['threshold_optimal']['roc_auc']:.3f}")
    print(f"  Optimal threshold: {opt_thresh}")
    print(f"  Plots saved to: app/ml/outputs/plots/")
    print("="*60 + "\n")

    return trained_pipelines[best_name], report


if __name__ == "__main__":
    train()
