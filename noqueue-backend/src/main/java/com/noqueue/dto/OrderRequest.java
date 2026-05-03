package com.noqueue.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderRequest {
    private String fileUrl;
    private Integer pages;
    private String printType;
    private String colorType;
    private String binding;
    private BigDecimal price;
}
