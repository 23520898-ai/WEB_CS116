function DocsPage() {
  return (
    <section className="panel docs-panel">
      <h2>Huong Dan Su Dung Nen Tang</h2>

      <h3>1. Tai Khoan Nhom</h3>
      <ul>
        <li>He thong tao san 20 nhom: NHOM01 den NHOM20.</li>
        <li>Moi nhom dung chung 1 tai khoan, mat khau mac dinh: 12345678.</li>
        <li>Sau lan dang nhap dau, vao trang Team de doi mat khau va cap nhat thong tin thanh vien.</li>
      </ul>

      <h3>2. Task 1 - PIR</h3>
      <ul>
        <li>Dau vao nop: JSON dictionary customer_id - list item_id de goi y.</li>
        <li>Train data: nam 2025. Test blind: thang 01/2026 voi event purchased.</li>
        <li>Metrics hien thi minh bach: total_correct_recommendations, iou, reciprocal_rank_first_hit, precision_at_10, map.</li>
        <li>Danh gia tren cac customer co phat sinh giao dich purchased, bao gom ca user moi (cold start).</li>
      </ul>

      <h3>3. Task 2 - Sale Forecasting</h3>
      <ul>
        <li>Dau vao nop: CSV gom 3 cot location, item_id, prediction.</li>
        <li>Train data: nam 2025. Test blind: thang 01/2026 voi event purchased.</li>
        <li>Metrics: mae_sales, mae_revenue, mape_sales, mape_revenue.</li>
        <li>Chi tinh tren location co phat sinh giao dich; bo qua mat hang co sale_status = 0.</li>
      </ul>

      <h3>4. Leaderboard va Minh Bach Diem</h3>
      <ul>
        <li>Leaderboard chi so sanh diem giua cac nhom NHOM01..NHOM20.</li>
        <li>Khong cong bo du lieu ground truth cho nguoi dung.</li>
        <li>Moi bai nop deu luu lich su metrics de doi chieu ro rang trong trang History.</li>
      </ul>

      <h3>5. Huong Dan Admin</h3>
      <ul>
        <li>Admin co the xem danh sach nhom, thong tin thanh vien va lich su nop bai cua toan he thong.</li>
        <li>Admin co the reset mat khau tai khoan nhom ve mat khau moi (mac dinh khuyen nghi: 12345678).</li>
        <li>API tai lieu ky thuat cua backend dat tai duong dan /api/docs.</li>
      </ul>
    </section>
  );
}

export default DocsPage;
