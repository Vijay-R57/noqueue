package com.noqueue.repository;

import com.noqueue.model.Order;
import com.noqueue.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Single atomic-friendly query: find oldest highest-priority READY_TO_PRINT job
    @Query("SELECT o FROM Order o WHERE o.status = :status ORDER BY o.priority ASC, o.createdAt ASC LIMIT 1")
    Optional<Order> findNextByStatus(OrderStatus status);
}
