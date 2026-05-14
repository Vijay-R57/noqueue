package com.noqueue.service;

import com.noqueue.dto.OrderEventDto;
import com.noqueue.dto.OrderRequest;
import com.noqueue.model.Order;
import com.noqueue.model.OrderStatus;
import com.noqueue.model.User;
import com.noqueue.repository.OrderRepository;
import com.noqueue.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository      orderRepository;
    private final UserRepository       userRepository;
    private final OrderEventService    orderEventService;   // SSE broadcaster
    private final HybridQueueScheduler hybridScheduler;     // scoring engine

    // ── Create order ───────────────────────────────────────────────────────

    public Order createOrder(org.springframework.web.multipart.MultipartFile file, String printType, String colorType, String binding, String email) {
        // 1. Validate
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }
        if (!"application/pdf".equalsIgnoreCase(file.getContentType()) && 
            (file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".pdf"))) {
            throw new IllegalArgumentException("Only PDF files are supported");
        }

        // 2. Load PDF and Extract pages
        int pages = 0;
        try (org.apache.pdfbox.pdmodel.PDDocument document = org.apache.pdfbox.Loader.loadPDF(file.getBytes())) {
            pages = document.getNumberOfPages();
        } catch (Exception e) {
            log.error("Failed to parse PDF for user {}", email, e);
            throw new IllegalArgumentException("Corrupted or invalid PDF file");
        }

        // 3. Calculate price (Backend is source of truth)
        java.math.BigDecimal price = calculatePrice(pages, colorType, binding);

        User user = userRepository.findByEmail(email).orElseThrow();

        Order order = Order.builder()
                .user(user)
                // For now, store a mock URL since we aren't uploading to S3
                .fileUrl("/uploads/" + file.getOriginalFilename())
                .pages(pages)
                .printType(printType)
                .colorType(colorType)
                .binding(binding)
                .price(price)
                .tokenNumber(UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .priority(user.getRole().getPriority())
                .status(OrderStatus.WAITING)
                .build();

        Order saved = orderRepository.save(order);
        broadcastEvent(saved);          // notify all SSE clients of new order
        return saved;
    }

    private java.math.BigDecimal calculatePrice(int pages, String colorType, String binding) {
        long pageRate = "Color".equalsIgnoreCase(colorType) ? 5L : 2L;
        long total = pages * pageRate;
        
        if ("Spiral".equalsIgnoreCase(binding)) {
            total += 20L;
        } else if ("Soft".equalsIgnoreCase(binding)) {
            total += 30L;
        }
        
        return java.math.BigDecimal.valueOf(total);
    }

    // ── Claim next print job (hybrid scheduler, atomic) ────────────────────

    /**
     * Atomically claims the next available print job using the Hybrid Queue Scheduler.
     *
     * Algorithm:
     *   1. Load ALL READY_TO_PRINT orders (with user eagerly fetched to avoid N+1).
     *   2. Delegate to {@link HybridQueueScheduler#selectNext(List)} which scores
     *      every candidate using:
     *        effectiveScore = rolePriorityWeight
     *                       - (pages × 0.1)          ← SJF
     *                       - (waitingMinutes × 0.2)  ← Anti-starvation aging
     *      and returns the order with the LOWEST score.
     *   3. Re-fetch the winner inside this transaction (optimistic lock-safe),
     *      transition it to PRINTING, persist, and broadcast the SSE event.
     *   4. Return null if the queue is empty.
     *
     * @return the claimed Order (status = PRINTING), or {@code null} if no job is ready.
     */
    @Transactional
    public Order claimNextJob() {
        // Step 1 – load candidates
        List<Order> candidates = orderRepository.findAllReadyToPrint(OrderStatus.READY_TO_PRINT);

        if (candidates.isEmpty()) {
            log.debug("[QUEUE] No READY_TO_PRINT jobs available.");
            return null;
        }

        log.info("[QUEUE] Evaluating {} READY_TO_PRINT candidate(s) with hybrid scorer...", candidates.size());

        // Step 2 – score and select
        Optional<Order> winner = hybridScheduler.selectNext(candidates);

        if (winner.isEmpty()) {
            return null;
        }

        Order best = winner.get();

        log.info("[QUEUE] >>> Selected Token #{} | User: {} | Role: {} | Pages: {}",
                best.getTokenNumber(),
                best.getUser().getEmail(),
                best.getUser().getRole().name(),
                best.getPages());

        // Step 3 – transition to PRINTING (re-fetch inside transaction for safety)
        Order managed = orderRepository.findById(best.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "[QUEUE] Order " + best.getId() + " disappeared before claim!"));

        managed.setStatus(OrderStatus.PRINTING);
        Order saved = orderRepository.save(managed);
        broadcastEvent(saved);   // notify SSE listeners: PRINTING

        log.info("[QUEUE] <<< Claimed Token #{} → PRINTING", saved.getTokenNumber());
        return saved;
    }

    // ── Manual status update (admin / print-agent callback) ────────────────

    public Order updateOrderStatus(Long orderId, OrderStatus status) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.setStatus(status);
        Order saved = orderRepository.save(order);
        broadcastEvent(saved);               // notify: new status
        return saved;
    }

    // ── Internal helper ────────────────────────────────────────────────────

    /**
     * Builds an {@link OrderEventDto} from a saved Order and broadcasts it
     * to all active SSE subscribers via {@link OrderEventService}.
     */
    private void broadcastEvent(Order order) {
        OrderEventDto event = OrderEventDto.builder()
                .orderId(order.getId())
                .tokenNumber(order.getTokenNumber())
                .status(order.getStatus())
                .userName(order.getUser().getEmail())
                .updatedAt(order.getUpdatedAt() != null ? order.getUpdatedAt() : LocalDateTime.now())
                .build();

        orderEventService.broadcast(event);
    }
}

