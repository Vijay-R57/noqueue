package com.noqueue.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class EtaResponseDto {
    private int queuePosition;
    private int estimatedMinutes;
    private LocalDateTime expectedCompletion;
}
