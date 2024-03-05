package com.demo.todo;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * @author Irudaya Raj
 *
 */
@Repository
public interface ItemRepository extends JpaRepository<Item, UUID> {

}
