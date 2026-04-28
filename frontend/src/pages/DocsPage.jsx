function DocsPage() {
  return (
    <section className="panel docs-panel">
      <h2>Platform User Guide</h2>

      <h3>1. Team Accounts</h3>
      <ul>
        <li>The system pre-generated 20 teams: NHOM01 to NHOM20.</li>
        <li>Each team shares one account; default password: 12345678.</li>
        <li>After the first login, go to the Team page to change your password and update member information.</li>
      </ul>

      <h3>2. Task 1 - PIR (Personalized Item Recommendation)</h3>
      <ul>
        <li>Submission format: JSON dictionary mapping `customer_id` to a list of recommended `item_id`.</li>
        <li>Training data: Year 2025. Blind test: January 2026 "purchased" events.</li>
        <li>Transparent metrics: `total_correct_recommendations`, `iou`, `reciprocal_rank_first_hit`, `precision_at_10`, and `map`.</li>
        <li>Evaluation is based on customers with "purchased" transactions, including new users (cold start).</li>
        <li>Formula: precision_at_10 = (correct items in top 10) / min(10, actual items of that user).</li>
        <li>MAP is the Mean Average Precision per customer; AP is the average precision at each hit position.</li>
        <li>IoU = |predict intersection actual| / |predict union actual|; reciprocal_rank_first_hit = 1 / rank of first hit.</li>
      </ul>

      <h3>3. Task 2 - Sales Forecasting</h3>
      <ul>
        <li>Submission format: CSV file with 3 columns: `location`, `item_id`, and `prediction`.</li>
        <li>Training data: Year 2025. Blind test: January 2026 "purchased" events.</li>
        <li>Metrics: `mae_sales`, `mae_revenue`, `mape_sales`, `mape_revenue`.</li>
        <li>Only calculated for locations with transactions; items with `sale_status = 0` are ignored.</li>
        <li>MAE sales = mean(|actual_qty - prediction|).</li>
        <li>MAE revenue = mean(|revenue - pred_revenue|), where pred_revenue = prediction x unit_price.</li>
        <li>MAPE sales is the primary ranking metric; MAPE revenue is for additional reference.</li>
      </ul>

      <h3>4. Leaderboard and Scoring Transparency</h3>
      <ul>
        <li>The leaderboard only compares scores between teams NHOM01 to NHOM20.</li>
        <li>Ground truth data is not disclosed to users.</li>
        <li>Every submission stores a metrics history for clear comparison on the History page.</li>
      </ul>

      <h3>5. Admin Instructions</h3>
      <ul>
        <li>Admins can configure the maximum number of submissions per team per day.</li>
        <li>Admins can re-upload ground truth files via the Admin page.</li>
        <li>Supported ground truth formats: PIR (.json, .parquet), Forecast (.csv, .parquet).</li>
        <li>Technical backend API documentation is available at the `/api/docs` path.</li>
      </ul>
    </section>
  );
}

export default DocsPage;