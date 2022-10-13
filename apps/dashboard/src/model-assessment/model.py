
import pandas as pd
import numpy as np

from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier


from raiutils.data_processing import convert_to_list

import json


target_feature = 'income'
categorical_features = ['workclass', 'education', 'marital-status',
                        'occupation', 'relationship', 'race', 'gender', 'native-country']


def split_label(dataset, target_feature):
    X = dataset.drop([target_feature], axis=1)
    y = dataset[[target_feature]]
    return X, y


def create_classification_pipeline(X):
    pipe_cfg = {
        'num_cols': X.dtypes[X.dtypes == 'int64'].index.values.tolist(),
        'cat_cols': X.dtypes[X.dtypes == 'object'].index.values.tolist(),
    }
    num_pipe = Pipeline([
        ('num_imputer', SimpleImputer(strategy='median')),
        ('num_scaler', StandardScaler())
    ])
    cat_pipe = Pipeline([
        ('cat_imputer', SimpleImputer(strategy='constant', fill_value='?')),
        ('cat_encoder', OneHotEncoder(handle_unknown='ignore', sparse=False))
    ])
    feat_pipe = ColumnTransformer([
        ('num_pipe', num_pipe, pipe_cfg['num_cols']),
        ('cat_pipe', cat_pipe, pipe_cfg['cat_cols'])
    ])

    # Append classifier to preprocessing pipeline.
    # Now we have a full prediction pipeline.
    pipeline = Pipeline(steps=[('preprocessor', feat_pipe),
                               ('model', RandomForestClassifier(n_estimators=10, max_depth=5))])

    return pipeline


def train(task_type, feature_names, features, true_y):
    from js import console
    console.log(task_type, feature_names, features, true_y)
    
    X_train_original = pd.DataFrame(features, columns=feature_names)
    y_train = np.array(true_y)

    pipeline = create_classification_pipeline(X_train_original)

    y_train = y_train[target_feature].to_numpy()

    model = pipeline.fit(X_train_original, y_train)

    def request_prediction(data):
        data = pd.DataFrame(
            data, columns=X_train_original.columns)
        if (task_type == "classification"):
            return json.dumps(convert_to_list(model.predict_proba(data)))
        return json.dumps(convert_to_list(model.predict(data)))

    return request_prediction