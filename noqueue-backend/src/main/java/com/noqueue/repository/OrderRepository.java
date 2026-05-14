package com.noqueue.repository;

import com.noqueue.model.Order;
import com.noqueue.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // ── Legacy single-pick query (kept for reference / fallback) ──────────
    @Query("SELECT o FROM Order o WHERE o.status = :status ORDER BY o.priority ASC, o.createdAt ASC LIMIT 1")
    Optional<Order> findNextByStatus(OrderStatus status);

    // ── Hybrid scheduler: returns ALL ready jobs so scores can be computed ─
    // Eagerly join-fetch the user to avoid N+1 when reading role/email.
    @Query("SELECT o FROM Order o JOIN FETCH o.user WHERE o.status = :status ORDER BY o.createdAt ASC")
    List<Order> findAllReadyToPrint(OrderStatus status);
}

