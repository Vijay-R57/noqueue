package com.noqueue.controller;

import com.noqueue.dto.PaymentConfigDto;
import com.noqueue.service.PaymentConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/payment-config")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Allows the frontend to communicate with this backend without CORS issues
public class PaymentConfigController {

    private final PaymentConfigService service;

    @GetMapping
    public ResponseEntity<PaymentConfigDto> getConfig() {
        return ResponseEntity.ok(service.getConfig());
    }

    @PutMapping
    public ResponseEntity<PaymentConfigDto> updateConfig(@RequestBody PaymentConfigDto dto) {
        return ResponseEntity.ok(service.updateConfig(dto));
    }
}
