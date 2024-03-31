
with customers as (

    select * from {{ ref('stg_customers') }}

),

orders as (

    select * from {{ ref('stg_orders') }}

),

payments as (

    select * from {{ ref('stg_payments') }}

),

customer_orders as (

    select
        orders.customer_id,

        min(order_date) as first_order,
        max(order_date) as most_recent_order,
        count(order_id) as number_of_orders
    from orders

    group by 1

),

customer_orders_latest AS (
  SELECT
  customer_orders.customer_id,
  MAX(most_recent_order) AS latest_order -- getting the latest order date from all customers

  FROM customer_orders
  GROUP BY 1
),

customer_payments as (

    select
        orders.customer_id,
        sum(amount) as total_amount

    from payments

    left join orders using (order_id)

    group by 1

),

final as (

    SELECT
        customers.customer_id,
        customers.first_name,
        customers.last_name,
        30 AS age, -- fixed age is filtered using required_attributes on schema.yml
        customers.created,
        customer_orders.first_order,
        customer_orders.most_recent_order,
        customer_orders.number_of_orders,
        customer_payments.total_amount AS customer_lifetime_value,
        CAST(customer_orders.first_order AS DATE) - CAST(customers.created AS DATE) AS days_between_created_and_first_order,
        date_trunc('day', customer_orders.most_recent_order - customer_orders_latest.latest_order) AS days_since_last_order

    FROM customers

    LEFT JOIN customer_orders ON customers.customer_id = customer_orders.customer_id

    LEFT JOIN customer_payments ON customers.customer_id = customer_payments.customer_id

    LEFT JOIN customer_orders_latest ON customers.customer_id = customer_orders_latest.customer_id

)

select * from final
