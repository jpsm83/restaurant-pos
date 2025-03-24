business - DONE
salesPoint - DONE
employees - DONE
customer - DONE



dailySalesReports
- review the whole code
- probaly a better approach is to add user sales report when tables are closed
- addEmployeeToDailySalesReport tested and working



salesInstance - DONE
printers - DONE
schedules - DONE
suppliers - DONE
supplierGoods - DONE
businessGoods - DONE
promotions - DONE
orders - DONE
purchases - DONE
inventories - DONE
notifications - DONE

monthlyBusinessReport
reservations
cloudinaryActions

- add upload cloudinary to all POST and PATH of documents that have imageUrl or documentsUrl
    - BUSINESS - single image - DONE
    - SUPPLIER - single image - DONE
    - USER - single image - DONE
    - BUSINESSGOOD - mulitple image - DONE
    - SUPPLIERGOOD - mulitple image - DONE
    - EMPLOYEE - mulitple documents - DONE
    - PURCHASES - mulitple documents

- REVIEW ALL THE LOGIC OF SALES INSTANCES AND SALES POINT
- them review the cloudinary upload of sales point

- review all functions that need session as parameter
- daily saler report have to be tested once we got all the models tested and with data
- transform cloudinaryActions route to be a function to be used in all the creations that could have images
- when a salesInstance is created by client using qrCode, update the qrLastScanned of the salesPoint
- add collor themes for the types of businessGoods (or photo)
