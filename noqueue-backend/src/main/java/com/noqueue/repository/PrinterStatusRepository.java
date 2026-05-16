package com.noqueue.repository;

import com.noqueue.model.PrinterStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrinterStatusRepository extends JpaRepository<PrinterStatus, Long> {
}
