from datetime import datetime
from airflow.operators.bash import BashOperator
from airflow import DAG

with DAG('extract_dag',
        schedule_interval= None,
        start_date=datetime(2024,1,1),
        catchup=False
) as dag:

    extract_task = BashOperator(
        task_id='extract_task',
        bash_command= 'wget -c https://r2.datahub.io/clt98mhbp000nl708qb1tppbw/master/raw/top-level-domain-names.csv -O /workspaces/hands-on-introduction-data-engineering-4395021/lab/orchestrated/airflow-extract-data.csv'
    )
