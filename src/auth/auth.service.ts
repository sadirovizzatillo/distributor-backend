import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./dto/login.dto";
import { CreateUserDto } from "../users/dto/create-user.dto";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwt: JwtService
  ) {}

  async register(dto: CreateUserDto) {
    const exists = await this.usersService.findByPhone(dto.phone);
    if (exists) {
      throw new NotFoundException("Phone already registered");
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      name: dto.name,
      phone: dto.phone,
      role: dto.role,
      password: hash
    });

    return this.issueTokens(user.id, user.phone, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByPhone(dto.phone);
    console.log(dto.phone);
    if (!user) throw new BadRequestException("User not found");
    console.log(dto.password, user.password);

    console.log(await bcrypt.hash(dto.password, 10));
    const isMatch = await bcrypt.compare(dto.password, user.password);
    // const isMatch = dto.password === user.password;
    if (!isMatch) throw new UnauthorizedException("Invalid credentials");

    return this.issueTokens(user.id, user.phone, user.role);
  }

  issueTokens(userId: number, phone: string, role: string) {
    const payload = { sub: userId, phone, role };

    console.log(payload);

    const accessToken = this.jwt.sign(payload, { expiresIn: "55m" });
    const refreshToken = this.jwt.sign(payload, { expiresIn: "7d" });

    return { accessToken, refreshToken };
  }
}
