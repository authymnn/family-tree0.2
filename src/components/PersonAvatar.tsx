import React from 'react';
import { Person } from '../types/family';
import { getInitials } from '../utils/imageUtils';

interface PersonAvatarProps {
  person: Pick<Person, 'firstName' | 'nickname' | 'gender' | 'photo' | 'isDeceased'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PersonAvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export const PersonAvatar: React.FC<PersonAvatarProps> = ({
  person,
  size = 'md',
  className = '',
}) => {
  const palette =
    person.gender === 'male'
      ? 'bg-[#E3EFEA] text-[#225144] ring-[#C4DDD3]'
      : person.gender === 'female'
        ? 'bg-[#F8E7DE] text-[#9A4E28] ring-[#E9CBB9]'
        : 'bg-[#ECE8E0] text-[#5C5347] ring-[#D6CFC3]';

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-semibold ring-2 select-none ${
        SIZE_CLASSES[size]
      } ${palette} ${person.isDeceased ? 'grayscale-[35%] opacity-90' : ''} ${className}`}
    >
      {person.photo ? (
        <img
          src={person.photo}
          alt={person.firstName}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <span>{getInitials(person.firstName, person.nickname)}</span>
      )}
    </div>
  );
};
