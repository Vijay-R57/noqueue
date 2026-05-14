package com.noqueue.agent.model;



public class Order {
    private Long id;
    private String fileUrl;
    private String fileName;
    private Integer pages;
    private String colorType;
    private String printType;
    private String binding;
    private String status;
    private String tokenNumber;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Integer getPages() { return pages; }
    public void setPages(Integer pages) { this.pages = pages; }

    public String getColorType() { return colorType; }
    public void setColorType(String colorType) { this.colorType = colorType; }

    public String getPrintType() { return printType; }
    public void setPrintType(String printType) { this.printType = printType; }

    public String getBinding() { return binding; }
    public void setBinding(String binding) { this.binding = binding; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTokenNumber() { return tokenNumber; }
    public void setTokenNumber(String tokenNumber) { this.tokenNumber = tokenNumber; }

    @Override
    public String toString() {
        return "Order{" +
                "id=" + id +
                ", tokenNumber='" + tokenNumber + '\'' +
                ", fileUrl='" + fileUrl + '\'' +
                ", printType='" + printType + '\'' +
                '}';
    }
}
