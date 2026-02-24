import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/db";
import { products, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {

  async findAllByUserId(userId: string) {
    return db
      .select()
      .from(products)
      .where(eq(products.userId, Number(userId)));
  }

  async findAll() {
    const result = await db
      .select({
        id: products.id,
        userId: products.userId,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        createdAt: products.createdAt,
        agentId: users.id,
        agentName: users.name,
        agentPhone: users.phone,
      })
      .from(products)
      .leftJoin(users, eq(products.userId, users.id));

    return result.map(({ agentId, agentName, agentPhone, ...product }) => ({
      ...product,
      agent: agentId ? { id: agentId, name: agentName, phone: agentPhone } : null,
    }));
  }

  async findOne(id: number) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    return product;
  }

  async verifyOwnership(productId: number, userId: number) {
    const product = await this.findOne(productId);
    if (!product) throw new NotFoundException("Product not found");
    if (product.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }
    return product;
  }

  async create(data: CreateProductDto) {
    const createData: any = { ...data };

    if (createData.price !== undefined && createData.price !== null) {
      createData.price = String(createData.price);
    }

    const [newProduct] = await db
      .insert(products)
      .values(createData)
      .returning();

    return newProduct;
  }

  async update(id: number, data: UpdateProductDto) {
    const updateData: any = { ...data };

    if (updateData.price !== undefined && updateData.price !== null) {
      updateData.price = String(updateData.price);
    }

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  }

  async remove(id: number) {
    await db.delete(products).where(eq(products.id, id));
    return { message: "Product deleted" };
  }
}
