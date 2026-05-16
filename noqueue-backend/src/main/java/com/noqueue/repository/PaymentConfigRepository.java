package com.noqueue.repository;

import com.noqueue.model.PaymentConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentConfigRepository extends JpaRepository<PaymentConfig, Long> {
}
