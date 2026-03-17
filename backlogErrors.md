- 1 Create users (people identities) - A user can be linked to the business as employee but it is a total individual user, a user log into the app as normal user and make orders at any business as self customer or can log into the app as employee. this choice supose to be allowed on the log in page of the app, the app check if user has an employee status and if so it gives hin the choice to log in as normal user or employee. to login as employee the user also have to be allowed by the schedule, he can be employee but not schedule to work at that time so still we could see the option to login as normal user or employee but at that time the employee login button can be disable. In simple context, user can be anyone that want use the app for a personal orders, while user can also be an employee but that is dictacte by the business and if so the user has both options of self login, normal user or employee, and the employee login will only be enable if he is on schedule for that time. - DONE

- 1 Configure schedules and labour cost - The schedule configuration by the manager cannot be optional once the user cannot login as employee if the schedule not permit it. the user supose to be abble to login as employee 5 minutes prior the scheduele start time. Implementation detail: for **non-admin employees**, the schedule for today and the 5-minute window before shift start are required for employee login; employees whose `allEmployeeRoles` includes the **Admin** role can log in as employee at any time, even when not scheduled. - DONE

- 1 Configure promotions - Promotions are apply on the fly by the frontend so the user can see the updated price but those promotions also must be applyed, or better saying, validating on the backend for precision and validations of data. - DONE

- 1 Create sales points (tables, bar, rooms) - QR codes should not be only for user self-ordering, it can also be for employee to open a table and create a table instance, we must identify how is scanning the QR code by its login session, he can be a normal user self-ordering or it can be a employee on-duty. - DONE

- 3.1 Staff‑opened session - staff can open a table selecting from the ones existing or scaning the QR code that is linked to all the points of sale, the app will know if whoever opening the table is a normal user or an employee checking the session of this person - DONE

- 3.1 Self‑ordering - user can self order hinself login the app, them it must have 2 options, scan a QR code for order on site or choose the restarutante from a filter of choices he select. filter will show all the business he can order following his seach choices. - DONE

- 3.1 Self‑ordering via QR - if is a normal customer opening the table is has no other option but pay the order before send it, order must be payed and table closed, them an email with the confirmation supose to be sent to the user so the waiter can request a confirmation of the order before delivery it - DONE

- 3.1 Self‑ordering via home - use can self order from his home too for delivery, in that case user can login as normal customer, choose the restaurante and the same menu and flow as the "Self‑ordering via QR" would happens, the only difference is there was no table delivery but insted a address from the user. - DONE

- 3.2 Modifying orders during service - only staff with admin or superviser level can cancel or void orders, and void orders must be with a descriptio as waste, mistake, refund or any other reason but must be especify. - DONE

- 4 Recording purchases - The system supose to **increases** the actual current **Inventory** `dynamicSystemCount` for that supplier good by the purchased quantity (in the good’s measurement unit). - DONE

- 4 Editing purchase details - edit purchase can be done only by managers and must add the reason on the update of that register as it is done on the inventory physical count with re‑edit data for tracking - DONE

- 5 Physical counts and corrections - only managers and supervisers can re-edit a inventory - DONE

- 9 During service - Waiters, bartender or users can open tables and order at the bar/restaurante. the bar/restaurante supose to have its open times defined on the business model so users can order food from home only whem the business is open - DONE

- orders made by self-ordering or delivery must send the receit to the user email for comprovation - DONE

business - DONE
salesPoint - DONE
employees - DONE
customer - DONE
dailySalesReports - DONE
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

monthlyBusinessReport - DONE BUT NOT TESTED
reservations - DONE BUT NOT TESTED
cloudinaryActions

reservations has lots of logic for send email an notifications but many other features does the same, try to unify the sending of messages

- move the dummy data to mongodb

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

- must review the file app/api/v1/monthlyBusinessReport/toDo.md