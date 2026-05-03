package com.noqueue.controller;

import com.noqueue.dto.OrderRequest;
import com.noqueue.model.Order;
import com.noqueue.model.OrderStatus;
import com.noqueue.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<Order> createOrder(
            @RequestBody OrderRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        return ResponseEntity.ok(orderService.createOrder(request, email));
    }

    @GetMapping("/next")
    public ResponseEntity<Order> getNextOrder() {
        Order nextOrder = orderService.claimNextJob(); // atomic: find + mark PRINTING in one tx
        if (nextOrder == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(nextOrder);
    }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<Order> updateOrderStatus(
            @PathVariable Long orderId,
            @RequestParam OrderStatus status
    ) {
        return ResponseEntity.ok(orderService.updateOrderStatus(orderId, status));
    }
}
