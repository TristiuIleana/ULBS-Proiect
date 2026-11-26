import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const NAME = /^(?!.*\p{Cc}).*\p{L}.*$/u;
const PHONE = /^\+?(?=(?:\D*\d){7,15}\D*$)[\d ().-]+$/;

const trimText = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class SlotBookingDto {
  @IsString()
  @Matches(UUID)
  serviceId!: string;

  @IsString()
  @Matches(UUID)
  specialistId!: string;

  @IsInt()
  @Min(0)
  @Max(Date.UTC(9999, 11, 30, 23, 59, 59, 999)) // Leave room for the local offset.
  slotUtcMs!: number;
}

export class ContactDto {
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  @Matches(NAME)
  firstName!: string;

  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  @Matches(NAME)
  lastName!: string;

  @Transform(trimText)
  @IsString()
  @MaxLength(32)
  @Matches(PHONE)
  phone!: string;

  @Transform(trimText)
  @MaxLength(254)
  @IsEmail()
  email!: string;
}

export class PublicBookingDto extends ContactDto {
  @IsString()
  @Matches(UUID)
  serviceId!: string;

  @IsString()
  @Matches(UUID)
  specialistId!: string;

  @IsInt()
  @Min(0)
  @Max(Date.UTC(9999, 11, 30, 23, 59, 59, 999))
  slotUtcMs!: number;
}
