package com.noqueue.service;

import com.noqueue.dto.PaymentConfigDto;
import com.noqueue.model.PaymentConfig;
import com.noqueue.repository.PaymentConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentConfigService {

    private final PaymentConfigRepository repository;

    public PaymentConfigDto getConfig() {
        PaymentConfig config = repository.findById(1L).orElse(
                PaymentConfig.builder()
                        .upiId("shopowner@upi")
                        .merchantName("NoQueue Print Shop")
                        .cashEnabled(true)
                        .qrImageBase64(null)
                        .build()
        );

        return PaymentConfigDto.builder()
                .upiId(config.getUpiId())
                .merchantName(config.getMerchantName())
                .cashEnabled(config.isCashEnabled())
                .qrImageBase64(config.getQrImageBase64())
                .build();
    }

    @Transactional
    public PaymentConfigDto updateConfig(PaymentConfigDto dto) {
        PaymentConfig config = repository.findById(1L).orElse(new PaymentConfig());
        config.setId(1L);
        config.setUpiId(dto.getUpiId());
        config.setMerchantName(dto.getMerchantName());
        config.setCashEnabled(dto.isCashEnabled());
        
        if (dto.getQrImageBase64() != null) {
            config.setQrImageBase64(dto.getQrImageBase64());
        }

        config = repository.save(config);

        return PaymentConfigDto.builder()
                .upiId(config.getUpiId())
                .merchantName(config.getMerchantName())
                .cashEnabled(config.isCashEnabled())
                .qrImageBase64(config.getQrImageBase64())
                .build();
    }
}
