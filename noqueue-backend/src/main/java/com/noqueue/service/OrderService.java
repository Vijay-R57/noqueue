package com.noqueue.service;

import com.noqueue.dto.OrderRequest;
import com.noqueue.model.Order;
import com.noqueue.model.OrderStatus;
import com.noqueue.model.User;
import com.noqueue.repository.OrderRepository;
import com.noqueue.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    public Order createOrder(OrderRequest request, String email) {
        User user = userRepository.findByEmail(email).orElseThrow();

        Order order = Order.builder()
                .user(user)
                .fileUrl(request.getFileUrl())
                .pages(request.getPages())
                .printType(request.getPrintType())
                .colorType(request.getColorType())
                .binding(request.getBinding())
                .price(request.getPrice())
                .tokenNumber(UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .priority(user.getRole().getPriority())
                .status(OrderStatus.WAITING)
                .build();

        return orderRepository.save(order);
    }

    /**
     * Atomically claims the next available print job.
     * Uses @Transactional to ensure only one agent can claim a given job,
     * even if multiple agent instances are polling simultaneously.
     *
     * Flow:
     *   1. Find first READY_TO_PRINT order (by priority ASC, createdAt ASC)
     *   2. Immediately set its status to PRINTING within the same transaction
     *   3. Return the claimed order (or null if queue is empty)
     */
    @Transactional
    public Order claimNextJob() {
        return orderRepository.findNextByStatus(OrderStatus.READY_TO_PRINT)
                .map(order -> {
                    order.setStatus(OrderStatus.PRINTING);
                    return orderRepository.save(order);
                })
                .orElse(null);
    }

    public Order updateOrderStatus(Long orderId, OrderStatus status) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.setStatus(status);
        return orderRepository.save(order);
    }
}
