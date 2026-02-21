export class CreateAlertDto {
  type: string;
  severity?: string;
  title: string;
  message: string;
  distributorId?: number;
  shopId?: number;
  orderId?: number;
  metadata?: any;
}