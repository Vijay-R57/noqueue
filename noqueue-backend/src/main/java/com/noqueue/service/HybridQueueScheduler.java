package com.noqueue.service;

import com.noqueue.model.Order;
import com.noqueue.model.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Hybrid Queue Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Combines three scheduling strategies to produce a single "effective score"
 * for every READY_TO_PRINT job.  The job with the LOWEST score is claimed next.
 *
 * ① Role-Based Priority Weight
 *   PRINCIPAL / DEAN / VICE_PRINCIPAL  →  weight = 10  (highest urgency)
 *   HOD / PROFESSOR                    →  weight =  7
 *   STUDENT                            →  weight =  3  (lowest base urgency)
 *
 * ② Shortest-Job-First (SJF) penalty
 *   Smaller jobs should finish faster.
 *   pagePenalty = pages × 0.1
 *
 * ③ Aging / Anti-Starvation bonus
 *   Every minute a job waits, its score drops (making it more urgent).
 *   agingBonus = waitingMinutes × 0.2
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *   effectiveScore = rolePriorityWeight
 *                  - (pages         × 0.1)   ← SJF: fewer pages → lower score
 *                  - (waitingMinutes × 0.2)   ← Aging: longer wait → lower score
 *
 *   SELECT the order with the LOWEST effectiveScore.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Service
public class HybridQueueScheduler {

    private static final Logger log = LoggerFactory.getLogger(HybridQueueScheduler.class);

    // ── Tuning constants ──────────────────────────────────────────────────────
    private static final double SJF_PAGE_PENALTY   = 0.1;   // per page
    private static final double AGING_BONUS_PER_MIN = 0.2;  // per waiting minute

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Given the full list of READY_TO_PRINT orders, selects the one with the
     * lowest effective score.  Returns {@link Optional#empty()} if the list is empty.
     *
     * @param candidates all READY_TO_PRINT orders (user must be eagerly loaded)
     * @return the highest-priority order per the hybrid formula
     */
    public Optional<Order> selectNext(List<Order> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Optional.empty();
        }

        return candidates.stream()
                .min(Comparator.comparingDouble(this::calculateScore));
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    /**
     * Computes the hybrid effective score for one order and emits a debug log.
     *
     * Lower score = higher scheduling priority.
     */
    public double calculateScore(Order order) {
        Role   role            = order.getUser().getRole();
        int    roleWeight      = role.getPriorityWeight();
        int    pages           = order.getPages() != null  ? order.getPages() : 1;
        long   waitingMinutes  = minutesWaiting(order);

        double pagePenalty     = pages          * SJF_PAGE_PENALTY;
        double agingBonus      = waitingMinutes * AGING_BONUS_PER_MIN;
        double score           = roleWeight - pagePenalty - agingBonus;

        logDebug(order, role, pages, waitingMinutes, score);

        return score;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private long minutesWaiting(Order order) {
        if (order.getCreatedAt() == null) return 0L;
        return Duration.between(order.getCreatedAt(), LocalDateTime.now()).toMinutes();
    }

    private void logDebug(Order order, Role role, int pages, long waitingMinutes, double score) {
        log.debug(
            "[QUEUE] Token #{} | Role: {} | Pages: {} | Waiting: {} mins | Score: {}",
            order.getTokenNumber(),
            role.name(),
            pages,
            waitingMinutes,
            String.format("%.2f", score)
        );
    }
}
