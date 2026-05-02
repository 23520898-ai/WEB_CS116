from typing import Dict, List


def _unique_keep_order(values: List[str]) -> List[str]:
    seen = set()
    ordered = []
    for v in values:
        if v not in seen:
            seen.add(v)
            ordered.append(v)
    return ordered


def compute_pir_metrics(
    predictions: Dict[str, List[str]],
    ground_truth: Dict[str, List[str]],
) -> Dict[str, float]:
    eligible_customers = [
        customer_id for customer_id, items in ground_truth.items() if len(items) > 0
    ]
    if not eligible_customers:
        return {
            "total_correct_recommendations": 0,
            "precision_at_10": 0.0,
            "map": 0.0,
            "iou": 0.0,
            "reciprocal_rank_first_hit": 0.0,
        }

    total_correct_recommendations = 0
    precision_scores = []
    ap_scores = []
    iou_scores = []
    rr_scores = []

    for customer_id in eligible_customers:
        actual_items = _unique_keep_order(ground_truth.get(customer_id, []))
        pred_items = _unique_keep_order(predictions.get(customer_id, []))

        actual_set = set(actual_items)
        pred_set = set(pred_items)
        total_correct_recommendations += len(actual_set & pred_set)

        # precision@10
        top10 = pred_items[:10]
        hit_count = len(set(top10) & actual_set)
        # Chia cho min(10, |actual|) để submission đúng hoàn toàn đạt 1.0
        denom = min(10, len(actual_set)) if actual_set else 1
        precision = hit_count / denom
        precision_scores.append(precision)

        # AP
        hit_seen = 0
        precision_sum = 0.0
        for rank, item_id in enumerate(pred_items, start=1):
            if item_id in actual_set:
                hit_seen += 1
                precision_sum += hit_seen / rank
        ap = precision_sum / len(actual_set) if actual_set else 0.0
        ap_scores.append(ap)

        # IOU
        union_size = len(actual_set | pred_set)
        iou = len(actual_set & pred_set) / union_size if union_size > 0 else 0.0
        iou_scores.append(iou)

        # RR
        rr = 0.0
        for rank, item_id in enumerate(pred_items, start=1):
            if item_id in actual_set:
                rr = 1.0 / rank
                break
        rr_scores.append(rr)

    n = len(eligible_customers)
    return {
        "total_correct_recommendations": int(total_correct_recommendations),
        "precision_at_10": round(sum(precision_scores) / n, 6),
        "map": round(sum(ap_scores) / n, 6),
        "iou": round(sum(iou_scores) / n, 6),
        "reciprocal_rank_first_hit": round(sum(rr_scores) / n, 6),
    }