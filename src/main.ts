import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Add global api prefix
  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // throw error if unknown props sent
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  );
  await app.listen(3000);
  console.log("🚀 Server running on http://localhost:3000");
  console.log("📡 API available at http://localhost:3000/api");
}
bootstrap();
